import * as ts from 'typescript'

const DEFAULT_DECORATORS = ['Reflectable', 'DeclareService', 'DeclareComponent']

export function before(
  options: { decorators?: string[] },
  _program: ts.Program
): ts.TransformerFactory<ts.SourceFile> {
  const triggers = new Set(options?.decorators ?? DEFAULT_DECORATORS)

  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (sourceFile: ts.SourceFile): ts.SourceFile => {
      const typeOnlyNames = collectTypeOnlyNames(sourceFile)
      let needsTypeImport = false

      let result = ts.visitNode(sourceFile, visit) as ts.SourceFile

      if (needsTypeImport && !hasTypeValueImport(sourceFile))
        result = injectTypeImport(result)

      return result

      function visit(node: ts.Node): ts.Node {
        if (ts.isClassDeclaration(node) && hasTriggerDecorator(node, triggers))
          return transformClass(node, typeOnlyNames, onSchemaRef)
        return ts.visitEachChild(node, visit, context)
      }

      function onSchemaRef() { needsTypeImport = true }
    }
  }
}

/* =========================================================
 * Collect type-only import names from the source file.
 * These are interfaces / type aliases with no runtime value.
 * ========================================================= */

function collectTypeOnlyNames(sourceFile: ts.SourceFile): Set<string> {
  const typeOnly = new Set<string>()

  for (const stmt of sourceFile.statements) {
    // import type { Foo } or import { type Foo }
    if (ts.isImportDeclaration(stmt)) {
      const { importClause } = stmt
      if (!importClause) continue
      const named = importClause.namedBindings
      if (!named || !ts.isNamedImports(named)) continue
      for (const elem of named.elements) {
        if (importClause.isTypeOnly || elem.isTypeOnly)
          typeOnly.add(elem.name.text)
      }
      continue
    }

    // type Foo = ...  (local type alias — erased at runtime, no JS value)
    if (ts.isTypeAliasDeclaration(stmt))
      typeOnly.add(stmt.name.text)
  }

  return typeOnly
}

/* =========================================================
 * Check / inject  import { Type } from '@svx/common'
 * ========================================================= */

function hasTypeValueImport(sourceFile: ts.SourceFile): boolean {
  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt)) continue
    if (stmt.importClause?.isTypeOnly) continue
    const mod = (stmt.moduleSpecifier as ts.StringLiteral).text
    if (mod !== '@svx/common') continue
    const named = stmt.importClause?.namedBindings
    if (named && ts.isNamedImports(named))
      if (named.elements.some(e => e.name.text === 'Type' && !e.isTypeOnly))
        return true
  }
  return false
}

function injectTypeImport(sourceFile: ts.SourceFile): ts.SourceFile {
  const imp = ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      false,
      undefined,
      ts.factory.createNamedImports([
        ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier('Type'))
      ])
    ),
    ts.factory.createStringLiteral('@svx/common')
  )
  return ts.factory.updateSourceFile(sourceFile, [imp, ...sourceFile.statements])
}

/* =========================================================
 * Class transform
 * ========================================================= */

function transformClass(
  node: ts.ClassDeclaration,
  typeOnlyNames: Set<string>,
  onSchemaRef: () => void
): ts.ClassDeclaration {
  const fields: ts.ObjectLiteralExpression[] = []
  const methods: ts.ObjectLiteralExpression[] = []

  for (const member of node.members) {
    if (isStaticMember(member)) continue

    if (ts.isPropertyDeclaration(member)) {
      const entry = buildFieldEntry(member, typeOnlyNames, onSchemaRef)
      if (entry) fields.push(entry)
    }

    if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
      const entry = buildMethodEntry(member as ts.MethodDeclaration | ts.MethodSignature, typeOnlyNames, onSchemaRef)
      if (entry) methods.push(entry)
    }
  }

  if (fields.length === 0 && methods.length === 0) return node

  const entries: ts.ObjectLiteralElementLike[] = []
  if (fields.length > 0)
    entries.push(prop('fields', ts.factory.createArrayLiteralExpression(fields, true)))
  if (methods.length > 0)
    entries.push(prop('methods', ts.factory.createArrayLiteralExpression(methods, true)))

  const staticDescriptor = ts.factory.createPropertyDeclaration(
    [ts.factory.createToken(ts.SyntaxKind.StaticKeyword)],
    '_descriptor',
    undefined,
    undefined,
    ts.factory.createObjectLiteralExpression(entries, true)
  )

  return ts.factory.updateClassDeclaration(
    node,
    node.modifiers,
    node.name,
    node.typeParameters,
    node.heritageClauses,
    [...node.members, staticDescriptor]
  )
}

/* =========================================================
 * Field / method entry builders
 * ========================================================= */

function buildFieldEntry(
  member: ts.PropertyDeclaration,
  typeOnlyNames: Set<string>,
  onSchemaRef: () => void
): ts.ObjectLiteralExpression | null {
  if (!ts.isIdentifier(member.name)) return null
  const entries: ts.ObjectLiteralElementLike[] = [
    prop('name', ts.factory.createStringLiteral(member.name.text)),
    prop('ref', typeNodeToRef(member.type, typeOnlyNames, onSchemaRef)),
  ]
  if (member.questionToken)
    entries.push(prop('optional', ts.factory.createTrue()))
  return ts.factory.createObjectLiteralExpression(entries)
}

function buildMethodEntry(
  member: ts.MethodDeclaration | ts.MethodSignature,
  typeOnlyNames: Set<string>,
  onSchemaRef: () => void
): ts.ObjectLiteralExpression | null {
  if (!ts.isIdentifier(member.name)) return null

  const params = member.parameters.map(p =>
    ts.factory.createObjectLiteralExpression([
      prop('name', ts.factory.createStringLiteral(ts.isIdentifier(p.name) ? p.name.text : '_')),
      prop('ref', typeNodeToRef(p.type, typeOnlyNames, onSchemaRef)),
    ])
  )

  return ts.factory.createObjectLiteralExpression([
    prop('name', ts.factory.createStringLiteral(member.name.text)),
    prop('params', ts.factory.createArrayLiteralExpression(params)),
    prop('ret', typeNodeToRef(member.type, typeOnlyNames, onSchemaRef)),
  ])
}

/* =========================================================
 * Type serialisation  →  { t: () => Type, a?: [...] }
 *
 * Type-only names (interfaces, type aliases) have no runtime
 * value, so we emit  Type.get("Name")  — a schema registry
 * lookup — instead of a direct reference.
 * ========================================================= */

function typeNodeToRef(
  typeNode: ts.TypeNode | undefined,
  typeOnlyNames: Set<string>,
  onSchemaRef: () => void
): ts.ObjectLiteralExpression {
  if (!typeNode) return makeRef(id('Object'))

  if (ts.isArrayTypeNode(typeNode))
    return makeRef(id('Array'), [typeNodeToRef(typeNode.elementType, typeOnlyNames, onSchemaRef)])

  // T | undefined  or  T | null  →  use T; ignore the nullable member
  if (ts.isUnionTypeNode(typeNode)) {
    const concrete = typeNode.types.filter(t =>
      t.kind !== ts.SyntaxKind.UndefinedKeyword && t.kind !== ts.SyntaxKind.NullKeyword
    )
    if (concrete.length === 1)
      return typeNodeToRef(concrete[0], typeOnlyNames, onSchemaRef)
    return makeRef(id('Object'))
  }

  if (ts.isTypeReferenceNode(typeNode)) {
    const rootName = ts.isIdentifier(typeNode.typeName) ? typeNode.typeName.text : ''

    if (typeOnlyNames.has(rootName)) {
      onSchemaRef()
      // Emit Type.get("Name") so the runtime can resolve the schema and its implementing class.
      const typeGetCall = ts.factory.createCallExpression(
        ts.factory.createPropertyAccessExpression(id('Type'), 'get'),
        undefined,
        [ts.factory.createStringLiteral(rootName)]
      )
      if (typeNode.typeArguments?.length)
        return makeRef(typeGetCall, typeNode.typeArguments.map(a => typeNodeToRef(a, typeOnlyNames, onSchemaRef)))
      return makeRef(typeGetCall)
    }

    const nameExpr = entityNameToExpr(typeNode.typeName)
    if (typeNode.typeArguments?.length)
      return makeRef(nameExpr, typeNode.typeArguments.map(a => typeNodeToRef(a, typeOnlyNames, onSchemaRef)))
    return makeRef(nameExpr)
  }

  switch (typeNode.kind) {
    case ts.SyntaxKind.NumberKeyword:  return makeRef(id('Number'))
    case ts.SyntaxKind.StringKeyword:  return makeRef(id('String'))
    case ts.SyntaxKind.BooleanKeyword: return makeRef(id('Boolean'))
    case ts.SyntaxKind.VoidKeyword:
    case ts.SyntaxKind.UndefinedKeyword: return makeRef(ts.factory.createVoidZero())
    default: return makeRef(id('Object'))
  }
}

function makeRef(typeExpr: ts.Expression, args?: ts.ObjectLiteralExpression[]): ts.ObjectLiteralExpression {
  const entries: ts.ObjectLiteralElementLike[] = [prop('t', thunk(typeExpr))]
  if (args?.length)
    entries.push(prop('a', ts.factory.createArrayLiteralExpression(args)))
  return ts.factory.createObjectLiteralExpression(entries)
}

function thunk(expr: ts.Expression): ts.ArrowFunction {
  return ts.factory.createArrowFunction(
    undefined, undefined, [], undefined,
    ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
    expr
  )
}

/* =========================================================
 * Helpers
 * ========================================================= */

function entityNameToExpr(name: ts.EntityName): ts.Expression {
  if (ts.isIdentifier(name)) return ts.factory.createIdentifier(name.text)
  return ts.factory.createPropertyAccessExpression(entityNameToExpr(name.left), name.right.text)
}

function id(name: string): ts.Identifier {
  return ts.factory.createIdentifier(name)
}

function prop(name: string, value: ts.Expression): ts.PropertyAssignment {
  return ts.factory.createPropertyAssignment(name, value)
}

function isStaticMember(member: ts.ClassElement): boolean {
  return !!ts.getModifiers(member as ts.HasModifiers)?.some(m => m.kind === ts.SyntaxKind.StaticKeyword)
}

function hasTriggerDecorator(node: ts.ClassDeclaration, triggers: Set<string>): boolean {
  const decorators = ts.getDecorators?.(node) ?? (node as any).decorators ?? []
  return (decorators as ts.Decorator[]).some(d => {
    const expr = d.expression
    const name = ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)
      ? expr.expression.text
      : ts.isIdentifier(expr) ? expr.text : null
    return name !== null && triggers.has(name)
  })
}
