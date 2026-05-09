import { Injectable, Scope } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { plainToInstance, instanceToPlain, ClassConstructor } from 'class-transformer';
import { DeclareChannel, Channel, ServiceDescriptor } from './service';
import { TypeDescriptor, MethodDescriptor, ParameterDescriptor, Returns } from '../reflection';

/* =========================================================
 * Module-level constants
 * ========================================================= */

const HTTP_DECORATOR_TO_METHOD: Record<string, string> = {
  Get:     'GET',
  Post:    'POST',
  Put:     'PUT',
  Delete:  'DELETE',
  Patch:   'PATCH',
  Options: 'OPTIONS',
  Head:    'HEAD',
  All:     'GET',
}

const PARAM_DECORATOR_TO_KIND: Record<string, string> = {
  Body:    'body',
  Param:   'param',
  Query:   'query',
  Headers: 'headers',
}

const stripQuotes = (s: string): string => s.replace(/^["']|["']$/g, '')

type CompiledCall = (...args: any[]) => Promise<any>

/* =========================================================
 * RestChannel
 * ========================================================= */

@DeclareChannel('rest')
@Injectable()//{ scope: Scope.TRANSIENT })
export class RestChannel implements Channel {
  url?: string

  private calls = new Map<string, CompiledCall>()

  constructor(private readonly http: HttpService) {}

  call(descriptor: ServiceDescriptor, method: string, ...args: any[]): Promise<any> {
    if (this.calls.size === 0)
      this.compileAll(descriptor)

    const fn = this.calls.get(method)
    if (!fn)
      throw new Error(`No REST mapping for '${method}' on service '${descriptor.name}'`)

    return fn(...args)
  }

  private compileAll(descriptor: ServiceDescriptor): void {
    const typeDesc = TypeDescriptor.forType(descriptor.type as any)

    // @Controller prefix from class-level decorators
    const controllerDec = typeDesc.decorators.find(d => d.decorator.name === 'Controller')
    const prefix = controllerDec
      ? stripQuotes(controllerDec.arguments[0] as string)
      : ''

    typeDesc
      .getMethods()
      .forEach(methodDesc =>
        this.calls.set(methodDesc.name, this.compileMethod(methodDesc, prefix))
      )
  }

  private compileMethod(methodDesc: MethodDescriptor, prefix: string): CompiledCall {

    // ── HTTP verb + path ──────────────────────────────────
    const httpDec = methodDesc.decorators.find(d =>
      d.decorator.name in HTTP_DECORATOR_TO_METHOD
    )

    const axiosMethod = HTTP_DECORATOR_TO_METHOD[httpDec?.decorator.name ?? ''] ?? 'GET'
    const methodPath  = httpDec
      ? stripQuotes(httpDec.arguments[0] as string)
      : methodDesc.name

    const rawPath    = `/${prefix}/${methodPath}`.replace(/\/+/g, '/')
    const pathTokens = rawPath.split('/')

    // ── Path param names from URL template ───────────────
    const pathParamNames = new Set(
      pathTokens
        .filter(seg => seg.startsWith(':'))
        .map(seg => seg.slice(1))
    )

    // ── Extractors from ParameterDescriptor[] ────────────
    // No more (methodDesc as any).parameters — fully typed now
    const extractors = methodDesc.parameters.map((param: ParameterDescriptor) => {
      // explicit decorator wins
      const kindDec = param.decorators.find(d => d.decorator.name in PARAM_DECORATOR_TO_KIND)
      if (kindDec)
        return {
          index: param.index,
          kind:  PARAM_DECORATOR_TO_KIND[kindDec.decorator.name],
          data:  kindDec.arguments[0] as string | undefined,
        }

      // auto-infer: param name matches :token in path → path param
      if (pathParamNames.has(param.name))
        return { index: param.index, kind: 'param', data: param.name }

      // default: query param keyed by param name
      return { index: param.index, kind: 'query', data: param.name }
    })

    // ── Return type — resolved once at compile time ───────
    const returnType = this.resolveReturnType(methodDesc)

    // ── The compiled call — hot path ──────────────────────
    return (...args: any[]): Promise<any> => {
      const pathParams: Record<string, string> = {}
      const query:      Record<string, any>    = {}
      const headers:    Record<string, any>    = {}
      let   body:       any                    = undefined

      for (const ex of extractors) {
        const raw = args[ex.index]

        switch (ex.kind) {
          case 'body':
            body = instanceToPlain(raw)
            break

          case 'param':
            if (ex.data)
              pathParams[ex.data] = encodeURIComponent(raw)
            else if (typeof raw === 'object')
              for (const [k, v] of Object.entries(raw as object))
                pathParams[k] = encodeURIComponent(String(v))
            break

          case 'query':
            if (ex.data) query[ex.data] = raw
            else Object.assign(query, raw)
            break

          case 'headers':
            if (ex.data) headers[ex.data] = raw
            else Object.assign(headers, raw)
            break
        }
      }

      const resolvedPath = pathTokens
        .map(seg => seg.startsWith(':') ? (pathParams[seg.slice(1)] ?? seg) : seg)
        .join('/')

      return firstValueFrom(
        this.http.request({
          method:  axiosMethod,
          url:     `${this.url}${resolvedPath}`,
          params:  query,
          headers,
          data:    body,
        })
      ).then(response => {
        if (!returnType) return response.data

        return Array.isArray(response.data)
          ? response.data.map((item: unknown) => plainToInstance(returnType, item))
          : plainToInstance(returnType, response.data)
      })
    }
  }

  private resolveReturnType(methodDesc: MethodDescriptor): ClassConstructor<any> | undefined {
    const dec = methodDesc.getDecorator(Returns)
    if (dec) return dec.arguments[0] as ClassConstructor<any>

    if (!methodDesc.async && methodDesc.returnType !== Promise)
      return methodDesc.returnType

    return undefined
  }
}
