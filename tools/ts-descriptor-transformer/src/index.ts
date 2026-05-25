import * as ts from 'typescript'

const DEFAULT_DECORATORS = ['Reflectable', 'DeclareService', 'DeclareComponent']
const REFLECTABLE_TRIGGERS = new Set(['Reflectable'])
const HTTP_VERBS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete'])
const VERB_TO_SWAGGER: Record<string, string> = {
  Get:    'ApiOkResponse',
  Post:   'ApiCreatedResponse',
  Put:    'ApiOkResponse',
  Patch:  'ApiOkResponse',
  Delete: 'ApiNoContentResponse',
}

export function before(
  options: { decorators?: string[]; swagger?: boolean },
  _program: ts.Program
): ts.TransformerFactory<ts.SourceFile> {
  const triggers      = new Set(options?.decorators ?? DEFAULT_DECORATORS)
  const generateSwagger = options?.swagger !== false

  return (context: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (sourceFile: ts.SourceFile): ts.SourceFile => {
      const typeOnlyNames = collectTypeOnlyNames(sourceFile)
      let needsTypeImport    = false
      let needsResolveType   = false
      const swaggerImports   = new Set<string>()

      let result = ts.visitNode(sourceFile, visit) as ts.SourceFile

      // Inject @svx/common imports
      const needsCommonImport = needsTypeImport || needsResolveType
      if (needsCommonImport) {
        const names: string[] = []
        if (needsTypeImport)  names.push('Type')
        if (needsResolveType) names.push('resolveType')
        if (!hasCommonImport(sourceFile, names))
          result = injectCommonImport(result, names)
      }

      // Inject @nestjs/swagger imports
      if (swaggerImports.size > 0 && !hasNestjsSwaggerImport(sourceFile))
        result = injectSwaggerImports(result, swaggerImports)

      return result

      function visit(node: ts.Node): ts.Node {
        if (ts.isClassDeclaration(node) && hasTriggerDecorator(node, triggers)) {
          const isReflectable = hasTriggerDecorator(node, REFLECTABLE_TRIGGERS)
          return transformClass(
            node,
            typeOnlyNames,
            () => { needsTypeImport    = true },
            () => { needsResolveType   = true },
            (name: string) => { swaggerImports.add(name) },
            generateSwagger,
            isReflectable,
          )
        }
        return ts.visitEachChild(node, visit, context)
      }
    }
  }
}

/* =========================================================
 * Class transform
 * ========================================================= */

function transformClass(
  node: ts.ClassDeclaration,
  typeOnlyNames: Set<string>,
  onSchemaRef: () => void,
  onResolveTypeRef: () => void,
  onSwaggerImport: (name: string) => void,
  generateSwagger: boolean,
  isReflectable: boolean,
): ts.ClassDeclaration {
  let membersModified = false
  const fields:  ts.ObjectLiteralExpression[] = []
  const methods: ts.ObjectLiteralExpression[] = []
  const newMembers: ts.ClassElement[] = []
  const schemaVar = isReflectable ? getImplementsSchema(node) : null

  for (const originalMember of node.members) {
    let member: ts.ClassElement = originalMember

    if (isStaticMember(member)) {
      newMembers.push(member)
      continue
    }

    if (ts.isPropertyDeclaration(member)) {
      const entry = buildFieldEntry(member, typeOnlyNames, onSchemaRef)
      if (entry) fields.push(entry)

      if (generateSwagger && isReflectable) {
        const dec = buildApiPropertyDecorator(member, typeOnlyNames, onResolveTypeRef, onSwaggerImport, schemaVar)
        if (dec) {
          member = ts.factory.updatePropertyDeclaration(
            member,
            [dec, ...(member.modifiers ?? [])],
            member.name,
            member.questionToken ?? member.exclamationToken,
            member.type,
            member.initializer,
          )
          membersModified = true
        }
      }
    }

    if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
      const entry = buildMethodEntry(member as ts.MethodDeclaration | ts.MethodSignature, typeOnlyNames, onSchemaRef)
      if (entry) methods.push(entry)

      if (generateSwagger && ts.isMethodDeclaration(member)) {
        const decs = buildSwaggerMethodDecorators(member, typeOnlyNames, onResolveTypeRef, onSwaggerImport)
        if (decs.length > 0) {
          member = ts.factory.updateMethodDeclaration(
            member,
            [...decs, ...(member.modifiers ?? [])],
            member.asteriskToken,
            member.name,
            member.questionToken,
            member.typeParameters,
            member.parameters,
            member.type,
            member.body,
          )
          membersModified = true
        }
      }
    }

    newMembers.push(member)
  }

  const entries: ts.ObjectLiteralElementLike[] = []
  if (fields.length > 0)
    entries.push(prop('fields',  ts.factory.createArrayLiteralExpression(fields,  true)))
  if (methods.length > 0)
    entries.push(prop('methods', ts.factory.createArrayLiteralExpression(methods, true)))

  if (entries.length === 0 && !membersModified) return node

  if (entries.length > 0) {
    const staticDescriptor = ts.factory.createPropertyDeclaration(
      [ts.factory.createToken(ts.SyntaxKind.StaticKeyword)],
      '_descriptor',
      undefined,
      ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
      ts.factory.createObjectLiteralExpression(entries, true),
    )
    newMembers.push(staticDescriptor)
  }

  return ts.factory.updateClassDeclaration(
    node,
    node.modifiers,
    node.name,
    node.typeParameters,
    node.heritageClauses,
    newMembers,
  )
}

/* =========================================================
 * @ApiProperty for DTO fields
 * ========================================================= */

function buildApiPropertyDecorator(
  member: ts.PropertyDeclaration,
  typeOnlyNames: Set<string>,
  onResolveTypeRef: () => void,
  onSwaggerImport: (name: string) => void,
  schemaVar: string | null,
): ts.Decorator | null {
  const info = typeNodeToSwaggerInfo(member.type, typeOnlyNames, onResolveTypeRef)
  const props: ts.ObjectLiteralElementLike[] = []

  if (info) {
    props.push(prop('type', thunk(info.typeExpr)))
    if (info.isArray) props.push(prop('isArray', ts.factory.createTrue()))
  }

  if (member.questionToken || isUnionWithUndefined(member.type))
    props.push(prop('required', ts.factory.createFalse()))

  const fieldName  = ts.isIdentifier(member.name) ? member.name.text : null
  const jsDocDesc  = fieldName ? getJsDocDescription(member) : null

  if (fieldName && schemaVar) {
    // schema._description at runtime, JSDoc as static fallback via ??
    const schemaExpr: ts.Expression = buildSchemaDescriptionExpr(schemaVar, fieldName)
    const descExpr = jsDocDesc
      ? ts.factory.createBinaryExpression(schemaExpr, ts.SyntaxKind.QuestionQuestionToken, ts.factory.createStringLiteral(jsDocDesc))
      : schemaExpr
    props.push(prop('description', descExpr))
  } else if (jsDocDesc) {
    props.push(prop('description', ts.factory.createStringLiteral(jsDocDesc)))
  }

  onSwaggerImport('ApiProperty')
  return ts.factory.createDecorator(
    ts.factory.createCallExpression(
      id('ApiProperty'), undefined,
      props.length ? [ts.factory.createObjectLiteralExpression(props)] : [],
    )
  )
}

function buildSchemaDescriptionExpr(schemaVar: string, fieldName: string): ts.Expression {
  // schemaVar?.shape?.['fieldName']?._description
  return ts.factory.createPropertyAccessChain(
    ts.factory.createElementAccessChain(
      ts.factory.createPropertyAccessChain(
        id(schemaVar),
        ts.factory.createToken(ts.SyntaxKind.QuestionDotToken),
        id('shape'),
      ),
      ts.factory.createToken(ts.SyntaxKind.QuestionDotToken),
      ts.factory.createStringLiteral(fieldName),
    ),
    ts.factory.createToken(ts.SyntaxKind.QuestionDotToken),
    id('_description'),
  )
}

function getJsDocDescription(member: ts.PropertyDeclaration): string | null {
  const docs = (member as any).jsDoc as ts.JSDoc[] | undefined
  if (!docs?.length) return null
  const doc = docs[docs.length - 1]
  const comment = doc.comment
  if (typeof comment === 'string') return comment.trim() || null
  if (Array.isArray(comment)) {
    return (comment as ts.JSDocComment[])
      .filter(c => c.kind === ts.SyntaxKind.JSDocText)
      .map(c => (c as ts.JSDocText).text)
      .join('').trim() || null
  }
  return null
}

function getImplementsSchema(node: ts.ClassDeclaration): string | null {
  const decorators = ts.getDecorators?.(node) ?? (node as any).decorators ?? []
  for (const d of decorators as ts.Decorator[]) {
    const expr = d.expression
    if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) &&
        expr.expression.text === 'Implements') {
      const arg = expr.arguments[0]
      if (arg && ts.isIdentifier(arg)) return arg.text
    }
  }
  return null
}

/* =========================================================
 * Method-level Swagger decorators for controllers
 * ========================================================= */

function buildSwaggerMethodDecorators(
  member: ts.MethodDeclaration,
  typeOnlyNames: Set<string>,
  onResolveTypeRef: () => void,
  onSwaggerImport: (name: string) => void,
): ts.Decorator[] {
  const httpVerb = findHttpVerb(member)
  if (!httpVerb) return []

  const result: ts.Decorator[] = []

  // Return-type decorator
  if (httpVerb === 'Delete') {
    onSwaggerImport('ApiNoContentResponse')
    result.push(makeDecorator('ApiNoContentResponse', []))
  } else {
    const returnInfo = typeNodeToSwaggerInfo(member.type, typeOnlyNames, onResolveTypeRef)
    if (returnInfo) {
      const decoratorName = VERB_TO_SWAGGER[httpVerb]
      onSwaggerImport(decoratorName)
      const args: ts.ObjectLiteralElementLike[] = [prop('type', thunk(returnInfo.typeExpr))]
      if (returnInfo.isArray) args.push(prop('isArray', ts.factory.createTrue()))
      result.push(makeDecorator(decoratorName, [ts.factory.createObjectLiteralExpression(args)]))
    }
  }

  // @Body param → @ApiBody
  for (const param of member.parameters) {
    if (hasParamDecorator(param, 'Body')) {
      const info = typeNodeToSwaggerInfo(param.type, typeOnlyNames, onResolveTypeRef)
      if (info) {
        onSwaggerImport('ApiBody')
        result.push(makeDecorator('ApiBody', [
          ts.factory.createObjectLiteralExpression([prop('type', thunk(info.typeExpr))]),
        ]))
      }
      break
    }
  }

  // @Param('x') → @ApiParam per path param
  for (const param of member.parameters) {
    const paramName = getRouteParamName(param)
    if (paramName !== null) {
      const info = typeNodeToSwaggerInfo(param.type, typeOnlyNames, onResolveTypeRef)
      if (info) {
        onSwaggerImport('ApiParam')
        result.push(makeDecorator('ApiParam', [
          ts.factory.createObjectLiteralExpression([
            prop('name',     ts.factory.createStringLiteral(paramName)),
            prop('type',     info.typeExpr),
            prop('required', ts.factory.createTrue()),
          ]),
        ]))
      }
    }
  }

  return result
}

/* =========================================================
 * Swagger type resolution
 * ========================================================= */

interface SwaggerTypeInfo { typeExpr: ts.Expression; isArray: boolean }

function typeNodeToSwaggerInfo(
  typeNode: ts.TypeNode | undefined,
  typeOnlyNames: Set<string>,
  onResolveTypeRef: () => void,
): SwaggerTypeInfo | null {
  if (!typeNode) return null

  if (typeNode.kind === ts.SyntaxKind.VoidKeyword ||
      typeNode.kind === ts.SyntaxKind.UndefinedKeyword) return null

  // Promise<T> → unwrap
  if (ts.isTypeReferenceNode(typeNode) &&
      ts.isIdentifier(typeNode.typeName) &&
      typeNode.typeName.text === 'Promise') {
    return typeNode.typeArguments?.length === 1
      ? typeNodeToSwaggerInfo(typeNode.typeArguments[0], typeOnlyNames, onResolveTypeRef)
      : null
  }

  // T[]
  if (ts.isArrayTypeNode(typeNode)) {
    const elem = typeNodeToSwaggerInfo(typeNode.elementType, typeOnlyNames, onResolveTypeRef)
    return elem ? { typeExpr: elem.typeExpr, isArray: true } : null
  }

  // Array<T>
  if (ts.isTypeReferenceNode(typeNode) &&
      ts.isIdentifier(typeNode.typeName) &&
      typeNode.typeName.text === 'Array') {
    if (typeNode.typeArguments?.length === 1) {
      const elem = typeNodeToSwaggerInfo(typeNode.typeArguments[0], typeOnlyNames, onResolveTypeRef)
      return elem ? { typeExpr: elem.typeExpr, isArray: true } : null
    }
    return null
  }

  // T | undefined → unwrap
  if (ts.isUnionTypeNode(typeNode)) {
    const concrete = typeNode.types.filter(t =>
      t.kind !== ts.SyntaxKind.UndefinedKeyword && t.kind !== ts.SyntaxKind.NullKeyword
    )
    return concrete.length === 1
      ? typeNodeToSwaggerInfo(concrete[0], typeOnlyNames, onResolveTypeRef)
      : null
  }

  // Named type reference
  if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
    const name = typeNode.typeName.text
    if (typeOnlyNames.has(name)) {
      onResolveTypeRef()
      return {
        typeExpr: ts.factory.createCallExpression(
          id('resolveType'), undefined, [ts.factory.createStringLiteral(name)]
        ),
        isArray: false,
      }
    }
    return { typeExpr: id(name), isArray: false }
  }

  // Primitives
  switch (typeNode.kind) {
    case ts.SyntaxKind.NumberKeyword:  return { typeExpr: id('Number'),  isArray: false }
    case ts.SyntaxKind.StringKeyword:  return { typeExpr: id('String'),  isArray: false }
    case ts.SyntaxKind.BooleanKeyword: return { typeExpr: id('Boolean'), isArray: false }
    default: return null
  }
}

function isUnionWithUndefined(typeNode: ts.TypeNode | undefined): boolean {
  if (!typeNode || !ts.isUnionTypeNode(typeNode)) return false
  return typeNode.types.some(t =>
    t.kind === ts.SyntaxKind.UndefinedKeyword || t.kind === ts.SyntaxKind.NullKeyword
  )
}

/* =========================================================
 * Helper: find HTTP verb decorator on a method
 * ========================================================= */

function findHttpVerb(member: ts.MethodDeclaration): string | null {
  const decorators = ts.getDecorators?.(member) ?? (member as any).decorators ?? []
  for (const d of decorators as ts.Decorator[]) {
    const expr = d.expression
    const name = ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)
      ? expr.expression.text
      : ts.isIdentifier(expr) ? expr.text : null
    if (name && HTTP_VERBS.has(name)) return name
  }
  return null
}

function hasParamDecorator(param: ts.ParameterDeclaration, decoratorName: string): boolean {
  const decorators = ts.getDecorators?.(param) ?? (param as any).decorators ?? []
  return (decorators as ts.Decorator[]).some(d => {
    const expr = d.expression
    const name = ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)
      ? expr.expression.text
      : ts.isIdentifier(expr) ? expr.text : null
    return name === decoratorName
  })
}

function getRouteParamName(param: ts.ParameterDeclaration): string | null {
  const decorators = ts.getDecorators?.(param) ?? (param as any).decorators ?? []
  for (const d of decorators as ts.Decorator[]) {
    const expr = d.expression
    if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) &&
        expr.expression.text === 'Param') {
      const first = expr.arguments[0]
      if (first && ts.isStringLiteral(first)) return first.text
    }
  }
  return null
}

/* =========================================================
 * Collect type-only import names
 * ========================================================= */

function collectTypeOnlyNames(sourceFile: ts.SourceFile): Set<string> {
  const typeOnly = new Set<string>()

  for (const stmt of sourceFile.statements) {
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

    if (ts.isTypeAliasDeclaration(stmt))
      typeOnly.add(stmt.name.text)
  }

  return typeOnly
}

/* =========================================================
 * Import injection
 * ========================================================= */

function hasCommonImport(sourceFile: ts.SourceFile, names: string[]): boolean {
  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt) || stmt.importClause?.isTypeOnly) continue
    const mod = (stmt.moduleSpecifier as ts.StringLiteral).text
    if (mod !== '@svx/common') continue
    const named = stmt.importClause?.namedBindings
    if (named && ts.isNamedImports(named)) {
      const imported = new Set(named.elements.filter(e => !e.isTypeOnly).map(e => e.name.text))
      if (names.every(n => imported.has(n))) return true
    }
  }
  return false
}

function hasNestjsSwaggerImport(sourceFile: ts.SourceFile): boolean {
  return sourceFile.statements.some(stmt =>
    ts.isImportDeclaration(stmt) &&
    !stmt.importClause?.isTypeOnly &&
    (stmt.moduleSpecifier as ts.StringLiteral).text === '@nestjs/swagger'
  )
}

function injectCommonImport(sourceFile: ts.SourceFile, names: string[]): ts.SourceFile {
  const imp = ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      false, undefined,
      ts.factory.createNamedImports(
        names.map(n => ts.factory.createImportSpecifier(false, undefined, id(n)))
      )
    ),
    ts.factory.createStringLiteral('@svx/common')
  )
  return ts.factory.updateSourceFile(sourceFile, [imp, ...sourceFile.statements])
}

function injectSwaggerImports(sourceFile: ts.SourceFile, names: Set<string>): ts.SourceFile {
  const imp = ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      false, undefined,
      ts.factory.createNamedImports(
        [...names].map(n => ts.factory.createImportSpecifier(false, undefined, id(n)))
      )
    ),
    ts.factory.createStringLiteral('@nestjs/swagger')
  )
  return ts.factory.updateSourceFile(sourceFile, [imp, ...sourceFile.statements])
}

/* =========================================================
 * Field / method _descriptor entry builders
 * ========================================================= */

function buildFieldEntry(
  member: ts.PropertyDeclaration,
  typeOnlyNames: Set<string>,
  onSchemaRef: () => void,
): ts.ObjectLiteralExpression | null {
  if (!ts.isIdentifier(member.name)) return null
  const entries: ts.ObjectLiteralElementLike[] = [
    prop('name', ts.factory.createStringLiteral(member.name.text)),
    prop('ref',  typeNodeToRef(member.type, typeOnlyNames, onSchemaRef)),
  ]
  if (member.questionToken)
    entries.push(prop('optional', ts.factory.createTrue()))
  return ts.factory.createObjectLiteralExpression(entries)
}

function buildMethodEntry(
  member: ts.MethodDeclaration | ts.MethodSignature,
  typeOnlyNames: Set<string>,
  onSchemaRef: () => void,
): ts.ObjectLiteralExpression | null {
  if (!ts.isIdentifier(member.name)) return null

  const params = member.parameters.map(p =>
    ts.factory.createObjectLiteralExpression([
      prop('name', ts.factory.createStringLiteral(ts.isIdentifier(p.name) ? p.name.text : '_')),
      prop('ref',  typeNodeToRef(p.type, typeOnlyNames, onSchemaRef)),
    ])
  )

  return ts.factory.createObjectLiteralExpression([
    prop('name',   ts.factory.createStringLiteral(member.name.text)),
    prop('params', ts.factory.createArrayLiteralExpression(params)),
    prop('ret',    typeNodeToRef(member.type, typeOnlyNames, onSchemaRef)),
  ])
}

/* =========================================================
 * Type serialisation for _descriptor → { t: () => Type, a?: [...] }
 * ========================================================= */

function typeNodeToRef(
  typeNode: ts.TypeNode | undefined,
  typeOnlyNames: Set<string>,
  onSchemaRef: () => void,
): ts.ObjectLiteralExpression {
  if (!typeNode) return makeRef(id('Object'))

  if (ts.isArrayTypeNode(typeNode))
    return makeRef(id('Array'), [typeNodeToRef(typeNode.elementType, typeOnlyNames, onSchemaRef)])

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

/* =========================================================
 * Helpers
 * ========================================================= */

function makeDecorator(name: string, args: ts.Expression[]): ts.Decorator {
  return ts.factory.createDecorator(
    ts.factory.createCallExpression(id(name), undefined, args)
  )
}

function thunk(expr: ts.Expression): ts.ArrowFunction {
  return ts.factory.createArrowFunction(
    undefined, undefined, [], undefined,
    ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
    expr
  )
}

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
