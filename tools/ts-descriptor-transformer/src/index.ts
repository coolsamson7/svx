import * as ts from 'typescript'

const DEFAULT_DECORATORS = ['Reflectable', 'DeclareService', 'DeclareComponent']

export function before(
  options: { decorators?: string[] },
  _program: ts.Program
): ts.TransformerFactory<ts.SourceFile> {
  const triggers = new Set(options?.decorators ?? DEFAULT_DECORATORS)

  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (sourceFile: ts.SourceFile): ts.SourceFile => {
      return ts.visitNode(sourceFile, visit) as ts.SourceFile

      function visit(node: ts.Node): ts.Node {
        if (ts.isClassDeclaration(node) && hasTriggerDecorator(node, triggers))
          return transformClass(node)
        return ts.visitEachChild(node, visit, context)
      }
    }
  }
}

/* =========================================================
 * Class transform
 * ========================================================= */

function transformClass(node: ts.ClassDeclaration): ts.ClassDeclaration {
  const fields: ts.ObjectLiteralExpression[] = []
  const methods: ts.ObjectLiteralExpression[] = []

  for (const member of node.members) {
    if (isStaticMember(member)) continue

    if (ts.isPropertyDeclaration(member)) {
      const entry = buildFieldEntry(member)
      if (entry) fields.push(entry)
    }

    if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
      const entry = buildMethodEntry(member as ts.MethodDeclaration | ts.MethodSignature)
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

function buildFieldEntry(member: ts.PropertyDeclaration): ts.ObjectLiteralExpression | null {
  if (!ts.isIdentifier(member.name)) return null
  const entries: ts.ObjectLiteralElementLike[] = [
    prop('name', ts.factory.createStringLiteral(member.name.text)),
    prop('ref', typeNodeToRef(member.type)),
  ]
  if (member.questionToken)
    entries.push(prop('optional', ts.factory.createTrue()))
  return ts.factory.createObjectLiteralExpression(entries)
}

function buildMethodEntry(
  member: ts.MethodDeclaration | ts.MethodSignature
): ts.ObjectLiteralExpression | null {
  if (!ts.isIdentifier(member.name)) return null

  const params = member.parameters.map(p =>
    ts.factory.createObjectLiteralExpression([
      prop('name', ts.factory.createStringLiteral(ts.isIdentifier(p.name) ? p.name.text : '_')),
      prop('ref', typeNodeToRef(p.type)),
    ])
  )

  return ts.factory.createObjectLiteralExpression([
    prop('name', ts.factory.createStringLiteral(member.name.text)),
    prop('params', ts.factory.createArrayLiteralExpression(params)),
    prop('ret', typeNodeToRef(member.type)),
  ])
}

/* =========================================================
 * Type serialisation  →  { t: () => Type, a?: [...] }
 * ========================================================= */

function typeNodeToRef(typeNode: ts.TypeNode | undefined): ts.ObjectLiteralExpression {
  if (!typeNode) return makeRef(id('Object'))

  if (ts.isArrayTypeNode(typeNode))
    return makeRef(id('Array'), [typeNodeToRef(typeNode.elementType)])

  if (ts.isTypeReferenceNode(typeNode)) {
    const nameExpr = entityNameToExpr(typeNode.typeName)
    if (typeNode.typeArguments?.length)
      return makeRef(nameExpr, typeNode.typeArguments.map(typeNodeToRef))
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
