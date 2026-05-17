/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { plainToInstance, instanceToPlain, ClassConstructor } from 'class-transformer';
import { DeclareChannel } from './service';
import { TypeDescriptor, MethodDescriptor, Returns } from '@svx/common';
import { ComponentDescriptor, Component, ServiceDescriptor, Channel, CachingChannelFactory } from '@svx/service-common';

/* =========================================================
 * Proxy schema types  (mirrors rest-proxies.json shape)
 * ========================================================= */

export interface ProxyParam {
  index:    number;
  in:       'path' | 'query' | 'body' | 'header';
  binding?: string;
}

export interface ProxyMethod {
  method:  string;
  path:    string;
  params?: ProxyParam[];
}

export interface ProxyService {
  basePath: string;
  [methodName: string]: ProxyMethod | string;
}

export type ProxySchema = Record<string, ProxyService>;

/* =========================================================
 * Constants  (fallback path only)
 * ========================================================= */

const HTTP_DECORATOR_TO_METHOD: Record<string, string> = {
  Get: 'GET', Post: 'POST', Put: 'PUT', Delete: 'DELETE',
  Patch: 'PATCH', Options: 'OPTIONS', Head: 'HEAD', All: 'GET',
}

const NEST_METHOD_TO_STRING: Record<number, string> = {
  0: 'GET', 1: 'POST', 2: 'PUT', 3: 'DELETE', 4: 'PATCH', 6: 'OPTIONS', 7: 'HEAD',
}
const ROUTE_ARGS_KEY = '__routeArguments__'
const PARAM_TYPE = 5, BODY_TYPE = 3, QUERY_TYPE = 4

export function extractNestJSRestSchema(implType: any): ProxyService {
  const basePath: string = Reflect.getMetadata('path', implType) ?? ''
  const service: ProxyService = { basePath }

  for (const methodName of Object.getOwnPropertyNames(implType.prototype)) {
    if (methodName === 'constructor') continue

    const handler      = implType.prototype[methodName]
    const routePath: string | undefined  = Reflect.getMetadata('path',   handler)
    const requestMethod: number | undefined = Reflect.getMetadata('method', handler)

    if (routePath === undefined || requestMethod === undefined) continue

    const params: ProxyParam[] = []
    const routeArgs = Reflect.getMetadata(ROUTE_ARGS_KEY, implType, methodName) ?? {}

    for (const [key, meta] of Object.entries(routeArgs) as [string, any][]) {
      const paramType = Number(key.split(':')[0])
      const { index, data } = meta

      if      (paramType === PARAM_TYPE) params.push({ index, in: 'path',  binding: data })
      else if (paramType === BODY_TYPE)  params.push({ index, in: 'body' })
      else if (paramType === QUERY_TYPE) params.push({ index, in: 'query', binding: data })
    }

    service[methodName] = { method: NEST_METHOD_TO_STRING[requestMethod] ?? 'GET', path: routePath, params }
  }

  return service
}

const stripQuotes = (s: string) => s.replace(/^["']|["']$/g, '')

/* =========================================================
 * Precomputed function types — what survives into the hot path
 * ========================================================= */

type Args           = any[]
type UrlBuilder     = (args: Args) => string
type BodyExtractor  = (args: Args) => any
type QueryExtractor = (args: Args) => Record<string, any> | undefined
type ResponseHandler = (data: any) => any
type CompiledCall   = (args: Args) => Promise<any>

@Injectable()
@DeclareChannel('rest')
export class RestChannelFactory extends CachingChannelFactory<RestChannel> {
  static imports   = [HttpModule]
  static providers: any[] = []

  // constructor

  constructor(private readonly http: HttpService) {
    super();
  }

  // implement

  createChannel(url: string) {
    const channel = new RestChannel(this.http)
    channel.url = url
    return channel
  }

  createWithMetadata(url: string, schema: ProxySchema): RestChannel {
    const channel = new RestChannel(this.http)
    channel.url = url
    channel.instanceSchema = schema
    return channel
  }

  metadataFor(descriptor: ComponentDescriptor<Component>): ProxySchema {
    const schema: ProxySchema = {}
    for (const svc of descriptor.services) {
      const implType = svc.instance?.constructor
      if (implType)
        schema[svc.name] = extractNestJSRestSchema(implType as any)
    }
    return schema
  }
}

@Injectable()
export class RestChannel implements Channel {
  // static

  private static schemas = new Map<string, ProxyService>()

  static loadReflection(data: ProxySchema): void {
    for (const [name, service] of Object.entries(data))
      RestChannel.schemas.set(name, service)
  }

  // instance data

  url?: string
  instanceSchema?: ProxySchema

  private calls = new Map<string, CompiledCall>()

  constructor(private readonly http: HttpService) {}

  call(descriptor: ServiceDescriptor, method: string, ...args: any[]): Promise<any> {
    if (this.calls.size === 0)
      this.compileAll(descriptor)

    const fn = this.calls.get(method)
    if (!fn)
      throw new Error(`No REST mapping for '${method}' on service '${descriptor.name}'`)

    return fn(args)
  }

  /* =========================================================
   * Compile all methods once — pure setup, nothing runs at call time
   * ========================================================= */

  private compileAll(descriptor: ServiceDescriptor): void {
    // 1. instance schema pre-loaded by channelMetadata (highest priority)
    const instanceService = this.instanceSchema?.[(descriptor.type as any).name]
                         ?? this.instanceSchema?.[descriptor.name]
    if (instanceService) {
      this.compileService(instanceService, TypeDescriptor.forType(descriptor.type as any))
      return
    }

    // 2. static schema from loadReflection
    const schema = RestChannel.schemas.get((descriptor.type as any).name)
                ?? RestChannel.schemas.get(descriptor.name)
    if (schema) {
      this.compileService(schema, TypeDescriptor.forType(descriptor.type as any))
      return
    }

    // 3. NestJS Reflect metadata fallback (server-side, no AbstractNestComponent)
    const implType     = (descriptor.instance?.constructor ?? descriptor.type) as any
    const nestjsPrefix = Reflect.getMetadata('path', implType) as string | undefined

    if (nestjsPrefix !== undefined) {
      this.compileFromNestJSController(implType)
    } else {
      const typeDesc   = TypeDescriptor.forType(implType)
      const controller = typeDesc.decorators.find(d => d.decorator.name === 'Controller')
      const prefix     = controller ? stripQuotes(controller.arguments[0] as string) : ''

      for (const method of typeDesc.getMethods())
        this.calls.set(method.name, this.compileMethod(method, prefix))
    }
  }

  private compileService(service: ProxyService, typeDesc: ReturnType<typeof TypeDescriptor.forType>): void {
    const { basePath, ...methodEntries } = service
    for (const [name, entry] of Object.entries(methodEntries))
      this.calls.set(name, this.compileFromProxy(entry as ProxyMethod, basePath as string, typeDesc.getMethod(name)))
  }

  private compileFromNestJSController(implType: any): void {
    const service = extractNestJSRestSchema(implType)
    const { basePath, ...methodEntries } = service
    for (const [name, entry] of Object.entries(methodEntries))
      this.calls.set(name, this.compileFromProxy(entry as ProxyMethod, basePath as string, undefined))
  }

  private compileFromProxy(
    proxy:    ProxyMethod,
    basePath: string,
    method?:  MethodDescriptor,
  ): CompiledCall {
    const template = `/${basePath}/${proxy.path}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/'

    const pathParams:  { index: number; key: string }[] = []
    const queryParams: { index: number; key: string }[] = []
    let   bodyIndex:   number | undefined

    for (const p of proxy.params ?? []) {
      if (p.in === 'path')
        pathParams.push({ index: p.index, key: p.binding ?? `arg${p.index}` })
      else if (p.in === 'body')
        bodyIndex = p.index
      else if (p.in === 'query')
        queryParams.push({ index: p.index, key: p.binding ?? `arg${p.index}` })
    }

    const buildUrl       = this.makeUrlBuilder(template, pathParams)
    const extractBody    = this.makeBodyExtractor(bodyIndex)
    const extractQuery   = this.makeQueryExtractor(queryParams)
    const handleResponse = this.makeResponseHandler(method ? this.resolveReturnType(method) : undefined)

    return async (args: Args): Promise<any> => {
      const res = await firstValueFrom(
        this.http.request({
          method: proxy.method,
          url:    `${this.url}${buildUrl(args)}`,
          data:   extractBody(args),
          params: extractQuery(args),
        })
      )
      return handleResponse(res.data)
    }
  }

  private compileMethod(method: MethodDescriptor, prefix: string): CompiledCall {
    const httpDec    = method.decorators.find(d => d.decorator.name in HTTP_DECORATOR_TO_METHOD)
    const httpMethod = HTTP_DECORATOR_TO_METHOD[httpDec?.decorator.name ?? ''] ?? 'GET'
    const basePath   = httpDec?.arguments?.[0] ? stripQuotes(httpDec.arguments[0] as string) : method.name
    const template   = `/${prefix}/${basePath}`.replace(/\/+/g, '/')

    // classify each parameter once
    const pathParams:  { index: number; key: string }[] = []
    const queryParams: { index: number; key: string }[] = []
    let   bodyIndex:   number | undefined

    for (const p of method.parameters) {
      const dec = p.decorators.find(d => ['Body', 'Param', 'Query'].includes(d.decorator.name))

      if (!dec || dec.decorator.name === 'Query')
        queryParams.push({ index: p.index, key: dec?.arguments?.[0] ?? p.name })

      else if (dec.decorator.name === 'Param')
        pathParams.push({ index: p.index, key: dec.arguments?.[0] ?? p.name })

      else if (dec.decorator.name === 'Body')
        bodyIndex = p.index
    }

    // precompute the four functions — no logic survives into the hot path
    const buildUrl      = this.makeUrlBuilder(template, pathParams)
    const extractBody   = this.makeBodyExtractor(bodyIndex)
    const extractQuery  = this.makeQueryExtractor(queryParams)
    const handleResponse = this.makeResponseHandler(this.resolveReturnType(method))

    // hot path: 4 calls + 1 await — zero branching, zero loops, zero metadata
    return async (args: Args): Promise<any> => {
      const res = await firstValueFrom(
        this.http.request({
          method: httpMethod,
          url:    `${this.url}${buildUrl(args)}`,
          data:   extractBody(args),
          params: extractQuery(args),
        })
      )
      return handleResponse(res.data)
    }
  }

  /* =========================================================
   * Function factories — each returns the simplest possible lambda
   * ========================================================= */

  private makeUrlBuilder(template: string, pathParams: { index: number; key: string }[]): UrlBuilder {
    // fully static URL — return a constant function (zero work per call)
    if (pathParams.length === 0)
      return () => template

    // precompute segments: static strings or arg-extractors
    const segments: Array<string | ((args: Args) => string)> = template
      .split('/')
      .map(seg => {
        if (!seg.startsWith(':')) return seg
        const p = pathParams.find(p => p.key === seg.slice(1))
        return p
          ? (args: Args) => encodeURIComponent(args[p.index])
          : seg
      })

    return (args: Args) => segments
      .map(s => typeof s === 'function' ? s(args) : s)
      .join('/')
  }

  private makeBodyExtractor(bodyIndex: number | undefined): BodyExtractor {
    if (bodyIndex === undefined) return () => undefined
    return (args: Args) => instanceToPlain(args[bodyIndex!])
  }

  private makeQueryExtractor(queryParams: { index: number; key: string }[]): QueryExtractor {
    if (queryParams.length === 0)
      return () => undefined

    // single param — no loop, no iteration
    if (queryParams.length === 1) {
      const { index, key } = queryParams[0]
      return (args: Args) => ({ [key]: args[index] })
    }

    // multiple params — loop is over a precomputed array, no branching
    return (args: Args) => {
      const q: Record<string, any> = {}
      for (const p of queryParams) q[p.key] = args[p.index]
      return q
    }
  }

  private makeResponseHandler(returnType?: ClassConstructor<any>): ResponseHandler {
    if (!returnType)
      return data => data

    return data => Array.isArray(data)
      ? data.map((x: any) => plainToInstance(returnType, x))
      : plainToInstance(returnType, data)
  }

  private resolveReturnType(method: MethodDescriptor): ClassConstructor<any> | undefined {
    const dec = method.getDecorator(Returns)
    if (dec) return dec.arguments[0] as ClassConstructor<any>

    if (!method.async && method.returnType !== Promise)
      return method.returnType

    return undefined
  }
}
