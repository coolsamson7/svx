import {
  Project,
  Node,
  ClassDeclaration,
  Decorator,
  CallExpression,
  ArrowFunction,
  VariableDeclaration,
} from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

import {
  UmlModel,
  UmlClass,
  UmlDataType,
  UmlAttribute,
  UmlAssociation,
  TaggedValue,
  Multiplicity,
} from '../model';

import {
  RelationKind,
  relationMultiplicities,
  tsPrimToUml,
} from './typeorm-meta';

import { walkObjectSchema } from './schema-walker';

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Stable association id: alphabetically ordered pair */
function assocId(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  return `assoc_${x}_${y}`;
}

/** Extract the identifier name from `() => SomeClass` or `(x) => SomeClass` */
function extractArrowTarget(decorator: Decorator): string | null {
  try {
    const args = decorator.getArguments();
    if (args.length === 0) return null;

    const firstArg = args[0];
    // Could be ArrowFunction or FunctionExpression
    let bodyExpr: Node | undefined;

    if (Node.isArrowFunction(firstArg)) {
      bodyExpr = (firstArg as ArrowFunction).getBody();
    } else if (Node.isFunctionExpression(firstArg)) {
      // function() { return SomeClass; }
      const retStmt = (firstArg as any).getBody().getStatements?.()[0];
      if (retStmt && Node.isReturnStatement(retStmt)) {
        bodyExpr = retStmt.getExpression() ?? undefined;
      }
    }

    if (!bodyExpr) return null;

    if (Node.isIdentifier(bodyExpr)) {
      return bodyExpr.getText();
    }
    return null;
  } catch {
    return null;
  }
}

/** Check whether a call expression's root callee name matches */
function callName(ce: CallExpression): string {
  const expr = ce.getExpression();
  if (Node.isIdentifier(expr)) return expr.getText();
  if (Node.isPropertyAccessExpression(expr)) return expr.getName();
  return '';
}

/* ------------------------------------------------------------------ */
/* Main parser                                                          */
/* ------------------------------------------------------------------ */

export function parseEntities(inputDir: string): UmlModel {
  const absDir = path.resolve(inputDir);

  if (!fs.existsSync(absDir)) {
    throw new Error(`Input directory does not exist: ${absDir}`);
  }

  // ── Build a ts-morph project ──────────────────────────────────────
  const project = new Project({
    compilerOptions: {
      experimentalDecorators: true,
      strict: false,
      skipLibCheck: true,
    },
    skipFileDependencyResolution: false,
    skipAddingFilesFromTsConfig: true,
  });

  // Add all .ts files from the input directory (recursively)
  const addTsFiles = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) addTsFiles(full);
      else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        project.addSourceFileAtPath(full);
      }
    }
  };
  addTsFiles(absDir);

  const model: UmlModel = { classes: [], dataTypes: [], associations: [] };

  // Named datatype registry: id → UmlDataType (accumulated during schema walking)
  const dataTypeMap = new Map<string, UmlDataType>();

  // Class stubs collected in Pass 1
  const classMap = new Map<string, UmlClass>();

  // Association dedup: pairKey → assoc (so OneToMany can override ManyToOne roles)
  const assocMap = new Map<string, UmlAssociation>();

  // ── Pass 1: collect classes and UmlDataType-decorated classes ──────
  for (const sf of project.getSourceFiles()) {
    for (const cls of sf.getClasses()) {
      if (hasDecorator(cls, 'UmlDataType')) {
        const id = cls.getName() ?? 'Unknown';
        if (!dataTypeMap.has(id)) {
          const dt: UmlDataType = { id, name: id, taggedValues: [] };
          dataTypeMap.set(id, dt);
        }
      }

      if (hasDecorator(cls, 'Entity')) {
        const name = cls.getName() ?? 'UnknownEntity';
        const stub: UmlClass = {
          id: name,
          name,
          attributes: [],
          taggedValues: [],
        };
        classMap.set(name, stub);
      }
    }
  }

  // ── Pass 2: enrich each @Entity class ─────────────────────────────
  for (const sf of project.getSourceFiles()) {
    for (const cls of sf.getClasses()) {
      if (!hasDecorator(cls, 'Entity')) continue;

      const name = cls.getName() ?? 'UnknownEntity';
      const umlClass = classMap.get(name);
      if (!umlClass) continue;

      // Extract table name from @Entity('tableName')
      const entityDec = cls.getDecorator('Entity');
      if (entityDec) {
        const args = entityDec.getArguments();
        if (args.length > 0 && Node.isStringLiteral(args[0])) {
          umlClass.taggedValues.push({
            tag: 'table-name',
            value: (args[0] as any).getLiteralValue() as string,
          });
        }
      }

      // Try to resolve schema from @Implements(SomeSchema) decorator
      const schemaFieldMap = resolveSchemaFields(cls, dataTypeMap, project);

      // Process properties
      for (const prop of cls.getProperties()) {
        try {
          processProperty(prop, umlClass, name, classMap, dataTypeMap, schemaFieldMap, assocMap, model);
        } catch (e) {
          console.warn(`[xmi-exporter] Warning: skipping property "${prop.getName()}" in ${name}: ${e}`);
        }
      }
    }
  }

  // Finalize model — exclude DataTypes that turned out to be class references
  model.classes = Array.from(classMap.values());
  model.dataTypes = Array.from(dataTypeMap.values()).filter(dt => !classMap.has(dt.id));
  model.associations = Array.from(assocMap.values());

  return model;
}

/* ------------------------------------------------------------------ */
/* Property processor                                                   */
/* ------------------------------------------------------------------ */

function processProperty(
  prop: any,
  umlClass: UmlClass,
  className: string,
  classMap: Map<string, UmlClass>,
  dataTypeMap: Map<string, UmlDataType>,
  schemaFieldMap: Map<string, { typeRef: string; isRef: boolean }>,
  assocMap: Map<string, UmlAssociation>,
  model: UmlModel,
): void {
  const propName = prop.getName();

  // Check for relation decorators first
  const relationKind = getRelationKind(prop);
  if (relationKind) {
    const relDec = prop.getDecorator(relationKind)!;
    const targetName = extractArrowTarget(relDec);
    if (!targetName) {
      console.warn(`[xmi-exporter] Could not extract target from ${relationKind} on ${className}.${propName}`);
      return;
    }

    // Check cascade
    const hasCascade = checkCascade(relDec);

    const mults = relationMultiplicities(relationKind as RelationKind);
    const pairKey = [className, targetName].sort().join(':');
    const aid = assocId(className, targetName);

    // Determine [A, B] canonical order (same as assocId: alphabetical)
    const [canonA, canonB] = [className, targetName].sort() as [string, string];
    const canonicalOrder = className === canonA; // true if className < targetName

    const taggedValues: TaggedValue[] = [];
    if (hasCascade) taggedValues.push({ tag: 'cascade', value: 'true' });

    const existing = assocMap.get(pairKey);

    if (!existing) {
      // First time seeing this pair — create from current decorator
      let sourceRole: string;
      let targetRole: string;

      if (relationKind === 'OneToMany') {
        sourceRole = className.replace(/Entity$/, '').toLowerCase();
        targetRole = propName;
      } else if (relationKind === 'ManyToOne') {
        // propName is the "many" side's FK ref; source side role is unknown
        sourceRole = className.replace(/Entity$/, '').toLowerCase();
        targetRole = propName;
      } else {
        sourceRole = className.replace(/Entity$/, '').toLowerCase();
        targetRole = propName;
      }

      const assoc: UmlAssociation = {
        id: aid,
        sourceId: className,
        targetId: targetName,
        sourceRole,
        targetRole,
        sourceMult: mults.sourceMult,
        targetMult: mults.targetMult,
        taggedValues,
      };
      assocMap.set(pairKey, assoc);
    } else {
      // Seen before — if we now have the OneToMany side, update roles with canonical names.
      // OneToMany on className.propName: propName is the collection (e.g. "addresses").
      // The existing entry was ManyToOne and used a guessed role; replace with accurate name.
      if (relationKind === 'OneToMany') {
        // propName is collection on className side
        // In the existing assoc, className is either source or target
        if (existing.sourceId === className) {
          existing.targetRole = propName;  // collection on the OneToMany side
        } else {
          existing.sourceRole = propName;
        }
        // Also propagate cascade if present
        if (hasCascade && !existing.taggedValues.some(tv => tv.tag === 'cascade')) {
          existing.taggedValues.push({ tag: 'cascade', value: 'true' });
        }
      }
      // For ManyToOne as second encounter, the OneToMany already provided better names — skip
    }
    return;
  }

  // Check for @PrimaryGeneratedColumn()
  const isPrimary = !!prop.getDecorator('PrimaryGeneratedColumn');
  // Check for @Column()
  const columnDec = prop.getDecorator('Column');

  if (!isPrimary && !columnDec) return; // not a mapped column

  const attrTaggedValues: TaggedValue[] = [];
  if (isPrimary) {
    attrTaggedValues.push({ tag: 'primary-key', value: 'true' });
    attrTaggedValues.push({ tag: 'generated', value: 'true' });
  }

  // Determine type first (needed to decide which column tags to emit)
  let typeRef: string;
  let isRef: boolean;

  const schemaType = schemaFieldMap.get(propName);
  if (schemaType) {
    typeRef = schemaType.typeRef;
    isRef = schemaType.isRef;
  } else {
    // Fallback: use TypeScript type
    const tsType = prop.getType().getText();
    typeRef = tsPrimToUml(stripOptional(tsType));
    isRef = false;
  }

  if (columnDec) {
    const opts = extractColumnOptions(columnDec);
    if (opts.name) attrTaggedValues.push({ tag: 'column-name', value: opts.name });
    if (opts.type) attrTaggedValues.push({ tag: 'column-type', value: opts.type });
    // length constraint lives on the named DataType when the type is a named reference
    if (opts.length != null && !isRef) attrTaggedValues.push({ tag: 'length', value: String(opts.length) });
    if (opts.nullable != null) attrTaggedValues.push({ tag: 'nullable', value: String(opts.nullable) });
  }

  const attr: UmlAttribute = {
    id: `${className}.${propName}`,
    name: propName,
    typeRef,
    isRef,
    taggedValues: attrTaggedValues,
  };

  umlClass.attributes.push(attr);
}

/* ------------------------------------------------------------------ */
/* Schema resolution                                                    */
/* ------------------------------------------------------------------ */

/**
 * Looks for @Implements(SomeSchema) on the class and walks the schema shape.
 * Returns a map of { fieldName -> { typeRef, isRef } }.
 */
function resolveSchemaFields(
  cls: ClassDeclaration,
  dataTypeMap: Map<string, UmlDataType>,
  project: Project,
): Map<string, { typeRef: string; isRef: boolean }> {
  const result = new Map<string, { typeRef: string; isRef: boolean }>();

  const implDec = cls.getDecorator('Implements');
  if (!implDec) return result;

  const args = implDec.getArguments();
  if (args.length === 0) return result;

  const schemaRefNode = args[0];
  if (!Node.isIdentifier(schemaRefNode)) return result;

  // Resolve to declaration
  let sym = schemaRefNode.getSymbol();
  if (!sym) return result;

  // If the symbol resolves to an ImportSpecifier, follow it to the actual export
  if (sym.getDeclarations()[0] && Node.isImportSpecifier(sym.getDeclarations()[0])) {
    sym = sym.getAliasedSymbol() ?? sym;
  }

  const decls = sym.getDeclarations();
  if (!decls || decls.length === 0) return result;

  const decl = decls[0];
  if (!Node.isVariableDeclaration(decl)) return result;

  const init = (decl as VariableDeclaration).getInitializer();
  if (!init || !Node.isCallExpression(init)) return result;

  const ce = init as CallExpression;
  // Must be an `object(...)` call
  if (callName(ce) !== 'object') return result;

  const fields = walkObjectSchema(ce);

  for (const field of fields) {
    const ft = field.type;
    if (ft.isNamedType) {
      // Register as UmlDataType if not already known, extracting constraints from its definition
      if (!dataTypeMap.has(ft.typeName)) {
        const { taggedValues, baseType } = resolveTypeConstraints(ft.typeName, project);
        dataTypeMap.set(ft.typeName, { id: ft.typeName, name: ft.typeName, baseType, taggedValues });
      }
      result.set(field.name, { typeRef: ft.typeName, isRef: true });
    } else {
      result.set(field.name, { typeRef: ft.typeName, isRef: false });
    }
  }

  return result;
}

/**
 * Finds an exported const by name in any source file and extracts schema constraints
 * and the UML base primitive type from its call chain.
 */
function resolveTypeConstraints(
  typeName: string,
  project: Project,
): { taggedValues: TaggedValue[]; baseType?: string } {
  for (const sf of project.getSourceFiles()) {
    for (const vd of sf.getVariableDeclarations()) {
      if (vd.getName() !== typeName) continue;
      const init = vd.getInitializer();
      if (init && Node.isCallExpression(init)) {
        return extractCallChainConstraints(init as CallExpression);
      }
    }
  }
  return { taggedValues: [] };
}

const ROOT_TO_UML: Record<string, string> = {
  string:  'String',
  int:     'Integer',
  number:  'Integer',
  boolean: 'Boolean',
  date:    'DateTime',
};

/**
 * Walks a schema call chain and extracts constraint tagged values plus the UML base type.
 * e.g. string().max(100).min(1) → { baseType: 'String', taggedValues: [...] }
 */
function extractCallChainConstraints(ce: CallExpression): { taggedValues: TaggedValue[]; baseType?: string } {
  const tags: TaggedValue[] = [];
  let root = '';

  // Find root function name (string, number, int, …)
  let n: Node = ce;
  while (Node.isCallExpression(n)) {
    const expr = (n as CallExpression).getExpression();
    if (Node.isIdentifier(expr)) { root = expr.getText(); break; }
    if (Node.isPropertyAccessExpression(expr)) n = expr.getExpression();
    else break;
  }

  const isString = root === 'string';

  // Walk method chain collecting constraints
  n = ce;
  while (Node.isCallExpression(n)) {
    const c = n as CallExpression;
    const expr = c.getExpression();
    if (Node.isPropertyAccessExpression(expr)) {
      const method = expr.getName();
      const args = c.getArguments();
      if (args.length > 0) {
        const val = args[0].getText();
        if (method === 'max') tags.push({ tag: isString ? 'max-length' : 'max', value: val });
        else if (method === 'min') tags.push({ tag: isString ? 'min-length' : 'min', value: val });
        else if (method === 'length') tags.push({ tag: 'length', value: val });
      }
      n = expr.getExpression();
    } else {
      break;
    }
  }

  return { taggedValues: tags, baseType: ROOT_TO_UML[root] };
}

/* ------------------------------------------------------------------ */
/* Utility helpers                                                      */
/* ------------------------------------------------------------------ */

function hasDecorator(cls: ClassDeclaration, name: string): boolean {
  return !!cls.getDecorator(name);
}

const RELATION_KINDS: RelationKind[] = ['OneToMany', 'ManyToOne', 'OneToOne', 'ManyToMany'];

function getRelationKind(prop: any): RelationKind | null {
  for (const kind of RELATION_KINDS) {
    if (prop.getDecorator(kind)) return kind;
  }
  return null;
}

function checkCascade(dec: Decorator): boolean {
  try {
    const args = dec.getArguments();
    // Options object is typically the 3rd argument for TypeORM relations
    for (const arg of args) {
      if (Node.isObjectLiteralExpression(arg)) {
        for (const prop of (arg as any).getProperties()) {
          if (Node.isPropertyAssignment(prop)) {
            if (prop.getName() === 'cascade' || prop.getName() === 'onDelete') {
              const val = prop.getInitializer();
              if (val) {
                const text = val.getText();
                if (text === 'true' || text.includes('CASCADE')) return true;
              }
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return false;
}

interface ColumnOptions {
  name?: string;
  type?: string;
  length?: number;
  nullable?: boolean;
}

function extractColumnOptions(dec: Decorator): ColumnOptions {
  const opts: ColumnOptions = {};
  try {
    const args = dec.getArguments();
    for (const arg of args) {
      if (Node.isStringLiteral(arg)) {
        opts.type = (arg as any).getLiteralValue() as string;
      } else if (Node.isObjectLiteralExpression(arg)) {
        for (const prop of (arg as any).getProperties()) {
          if (Node.isPropertyAssignment(prop)) {
            const pname = prop.getName();
            const init = prop.getInitializer();
            if (!init) continue;
            if (pname === 'name') opts.name = stripQuotes(init.getText());
            else if (pname === 'type') opts.type = stripQuotes(init.getText());
            else if (pname === 'length') opts.length = Number(init.getText());
            else if (pname === 'nullable') opts.nullable = init.getText() === 'true';
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return opts;
}

function stripQuotes(s: string): string {
  return s.replace(/^['"`]|['"`]$/g, '');
}

function stripOptional(tsType: string): string {
  // Remove " | undefined" or " | null" etc.
  return tsType
    .replace(/\s*\|\s*undefined/g, '')
    .replace(/\s*\|\s*null/g, '')
    .replace(/\[\]$/, '')
    .trim();
}
