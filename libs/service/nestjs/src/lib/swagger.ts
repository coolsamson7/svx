import { RequestMethod } from '@nestjs/common'
import {
  ApiProperty,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBody,
  ApiParam,
  ApiOperation,
} from '@nestjs/swagger'
import { getImplementingSchema, getImplementors } from '@svx/common'

const ROUTE_ARGS_METADATA = '__routeArguments__'
const PARAM_TYPE_BODY  = 3
const PARAM_TYPE_PARAM = 5

type Ref = { t: () => any; a?: Ref[] }
type SwaggerType = { type: any; isArray: boolean }

function refToSwaggerType(ref: Ref | undefined): SwaggerType | null {
  if (!ref) return null
  const t = ref.t?.()
  if (t == null) return null

  // Promise<T> → unwrap
  if (t === Promise && ref.a?.length === 1) return refToSwaggerType(ref.a[0])

  // Array / T[] → unwrap element
  if (t === Array && ref.a?.length === 1) {
    const inner = refToSwaggerType(ref.a[0])
    return inner ? { type: inner.type, isArray: true } : null
  }

  // Schema instance (from type-only imports: t() returns a Type object)
  if (t && typeof t === 'object' && typeof t.params4 === 'function') {
    const cls = getImplementors(t)[0]
    return cls ? { type: cls, isArray: false } : null
  }

  if (typeof t === 'function') return { type: t, isArray: false }
  return null
}

function buildConstraints(schemaField: any): Record<string, any> {
  if (!schemaField) return {}
  const f = schemaField.inner ?? schemaField
  const p4 = (name: string) => f.params4?.(name)
  const c: Record<string, any> = {}

  if (f.baseType === 'string') {
    const min = p4('min')?.min, max = p4('max')?.max, len = p4('length')?.length
    if (min != null || len != null) c.minLength = min ?? len
    if (max != null || len != null) c.maxLength = max ?? len
    const re = p4('matches')?.re
    if (re) c.pattern = re.source
    if (p4('email'))              c.format = 'email'
    else if (p4('format')?.format) c.format = p4('format').format
  } else if (f.baseType === 'number') {
    const min = p4('min')?.min, max = p4('max')?.max
    const gt = p4('greaterThan')?.number, lt = p4('lessThan')?.number
    if (min != null) c.minimum = min
    if (max != null) c.maximum = max
    if (gt  != null) c.exclusiveMinimum = gt
    if (lt  != null) c.exclusiveMaximum = lt
    if (p4('format')?.format) c.format = p4('format').format
  } else if (f.baseType === 'array') {
    const min = p4('min')?.min, max = p4('max')?.max
    if (min != null) c.minItems = min
    if (max != null) c.maxItems = max
  }

  return c
}

function isPrimitive(type: any): boolean {
  return type === String || type === Number || type === Boolean || type === Object
}

export function applySwaggerToDto(dtoClass: Function, processed = new Set<Function>()): void {
  if (processed.has(dtoClass)) return
  processed.add(dtoClass)

  const descriptor = (dtoClass as any)._descriptor
  if (!descriptor?.fields) return

  const schema    = getImplementingSchema(dtoClass)
  const proto     = dtoClass.prototype

  for (const field of descriptor.fields) {
    const schemaField = schema?.shape?.[field.name]
    const swaggerType = refToSwaggerType(field.ref)

    ApiProperty({
      ...(swaggerType && { type: () => swaggerType.type }),
      ...(swaggerType?.isArray && { isArray: true }),
      required: !field.optional,
      description: schemaField?._description ?? field.description ?? undefined,
      ...buildConstraints(schemaField),
    })(proto, field.name)

    if (swaggerType && !isPrimitive(swaggerType.type))
      applySwaggerToDto(swaggerType.type, processed)
  }
}

export function applySwaggerToController(controllerClass: Function): void {
  const parent     = Object.getPrototypeOf(controllerClass) as any
  const parentDesc = parent._descriptor
  if (!parentDesc) return

  const proto    = controllerClass.prototype
  const processed = new Set<Function>()

  for (const method of parentDesc.methods ?? []) {
    const propDesc = Object.getOwnPropertyDescriptor(proto, method.name)
    if (!propDesc) continue

    const methodFn = propDesc.value

    // @ApiOperation — from _descriptor description, skip if controller already has one
    if (method.description && !Reflect.hasMetadata('swagger/apiOperation', methodFn))
      ApiOperation({ summary: method.description })(proto, method.name, propDesc)

    const httpMethod: number | undefined = Reflect.getMetadata('method', methodFn)
    if (httpMethod === undefined) continue

    // Response decorator
    const retType = refToSwaggerType(method.ret)
    if (httpMethod === RequestMethod.DELETE) {
      ApiNoContentResponse()(proto, method.name, propDesc)
    } else if (retType) {
      const args = { type: () => retType.type, ...(retType.isArray && { isArray: true }) }
      if (httpMethod === RequestMethod.POST) ApiCreatedResponse(args)(proto, method.name, propDesc)
      else                                   ApiOkResponse(args)(proto, method.name, propDesc)
      if (!isPrimitive(retType.type)) applySwaggerToDto(retType.type, processed)
    }

    // @ApiBody / @ApiParam from NestJS route args metadata
    const routeArgs: Record<string, any> =
      Reflect.getMetadata(ROUTE_ARGS_METADATA, controllerClass, method.name) ?? {}

    for (const [key, arg] of Object.entries(routeArgs)) {
      const [typeStr, idxStr] = key.split(':')
      const paramKind = parseInt(typeStr)
      const paramIdx  = parseInt(idxStr)
      const paramType = refToSwaggerType(method.params[paramIdx]?.ref)
      if (!paramType) continue

      if (paramKind === PARAM_TYPE_BODY) {
        ApiBody({ type: () => paramType.type })(proto, method.name, propDesc)
        if (!isPrimitive(paramType.type)) applySwaggerToDto(paramType.type, processed)
      } else if (paramKind === PARAM_TYPE_PARAM) {
        ApiParam({ name: arg.data, type: paramType.type, required: true })(proto, method.name, propDesc)
      }
    }
  }
}
