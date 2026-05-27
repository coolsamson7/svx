import { Node, CallExpression, ObjectLiteralExpression, PropertyAssignment } from 'ts-morph';
import { schemaFnToUml } from './typeorm-meta';

export interface SchemaFieldType {
  /** UML primitive name (e.g. "String") or named type identifier (e.g. "PositiveInteger") */
  typeName: string;
  /** true when typeName is a named identifier (not a primitive) */
  isNamedType: boolean;
  /** true when wrapped in array(...) */
  isArray: boolean;
  /** true when wrapped in optional(...) */
  isOptional: boolean;
}

export interface SchemaField {
  name: string;
  type: SchemaFieldType;
}

/**
 * Given a CallExpression node whose callee is `object(...)`, extract the shape fields.
 * Returns an empty array if the node cannot be walked.
 */
export function walkObjectSchema(callExpr: CallExpression): SchemaField[] {
  const args = callExpr.getArguments();
  if (args.length === 0) return [];

  const shapeArg = args[0];
  if (!Node.isObjectLiteralExpression(shapeArg)) return [];

  const fields: SchemaField[] = [];

  for (const prop of (shapeArg as ObjectLiteralExpression).getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;

    const pa = prop as PropertyAssignment;
    const name = pa.getName().replace(/^['"]|['"]$/g, ''); // strip quotes
    const initializer = pa.getInitializer();
    if (!initializer) continue;

    const type = resolveSchemaExpr(initializer);
    fields.push({ name, type });
  }

  return fields;
}

/**
 * Recursively resolve a schema expression to its field type.
 * Handles: optional(x), array(x), identifier references, call chains like string().min(1)
 */
function resolveSchemaExpr(node: Node): SchemaFieldType {
  let isOptional = false;
  let isArray = false;

  // Unwrap optional() and array() wrappers — may be nested chains
  const inner = unwrapWrappers(node, (name) => {
    if (name === 'optional') isOptional = true;
    if (name === 'array') isArray = true;
  });

  // Now classify the inner expression
  if (Node.isIdentifier(inner)) {
    // Named type reference like PositiveInteger, AddressSchema etc.
    const name = inner.getText();
    // Schema references like AddressSchema → strip "Schema" suffix for cleaner names
    const typeName = name.endsWith('Schema') ? name.slice(0, -6) : name;
    return { typeName, isNamedType: true, isArray, isOptional };
  }

  if (Node.isCallExpression(inner)) {
    // e.g. string().min(1), number(), int().min(0)
    const fnName = getRootCalleeName(inner);
    const umlPrim = schemaFnToUml(fnName);
    return { typeName: umlPrim, isNamedType: false, isArray, isOptional };
  }

  // fallback
  return { typeName: 'String', isNamedType: false, isArray, isOptional };
}

/**
 * Peel off outer wrapper calls (optional, array) from a node.
 * Calls onWrapper for each wrapper found.
 */
function unwrapWrappers(
  node: Node,
  onWrapper: (name: string) => void,
): Node {
  // Property access chains like foo.bar() — peel method calls off
  // A chain like optional(array(string())) is nested CallExpressions
  if (!Node.isCallExpression(node)) return node;

  const ce = node as CallExpression;
  const callee = ce.getExpression();
  const calleeName = getCalleeName(callee);

  if (calleeName === 'optional' || calleeName === 'array') {
    onWrapper(calleeName);
    const innerArgs = ce.getArguments();
    if (innerArgs.length > 0) {
      return unwrapWrappers(innerArgs[0], onWrapper);
    }
  }

  return node;
}

/**
 * Get the simple name of a callee expression.
 * Handles: Identifier (foo), PropertyAccessExpression (foo.bar)
 */
function getCalleeName(expr: Node): string {
  if (Node.isIdentifier(expr)) return expr.getText();
  if (Node.isPropertyAccessExpression(expr)) {
    return expr.getName();
  }
  return '';
}

/**
 * For a call chain like string().min(1).max(100), get the root function name.
 */
function getRootCalleeName(ce: CallExpression): string {
  let expr: Node = ce.getExpression();
  while (Node.isPropertyAccessExpression(expr)) {
    expr = expr.getExpression();
  }
  // expr is now either an Identifier or another CallExpression
  if (Node.isIdentifier(expr)) return expr.getText();
  if (Node.isCallExpression(expr)) return getRootCalleeName(expr);
  return '';
}
