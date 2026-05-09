import { Injectable, Scope } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { plainToInstance, instanceToPlain, ClassConstructor } from 'class-transformer';
import { DeclareChannel, Channel, ServiceDescriptor } from './service';
import { TypeDescriptor, MethodDescriptor, Returns } from '../reflection';
import { ReflectedParameter } from '../reflection/reflector.interface';

/* =========================================================
 * Module-level constants — created once, never recreated
 * ========================================================= */

// Decorator name (as emitted by ts-morph JSON) → axios method string
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

// Parameter decorator name → routing kind
const PARAM_DECORATOR_TO_KIND: Record<string, string> = {
  Body:    'body',
  Param:   'param',
  Query:   'query',
  Headers: 'headers',
}

type CompiledCall = (...args: any[]) => Promise<any>

/* =========================================================
 * RestChannel
 * ========================================================= */

@DeclareChannel('rest')
@Injectable({ scope: Scope.TRANSIENT })
export class RestChannel implements Channel {
  url?: string

  // populated once on first call() via compileAll()
  private calls = new Map<string, CompiledCall>()

  constructor(private readonly http: HttpService) {}

  // -------------------------------------------------------
  // Channel
  // -------------------------------------------------------

  call(descriptor: ServiceDescriptor, method: string, ...args: any[]): Promise<any> {
    if (this.calls.size === 0)
      this.compileAll(descriptor)

    const fn = this.calls.get(method)
    if (!fn)
      throw new Error(`No REST mapping for '${method}' on service '${descriptor.name}'`)

    return fn(...args)
  }

  // -------------------------------------------------------
  // Compile all methods — runs once on first call()
  // -------------------------------------------------------

  private compileAll(descriptor: ServiceDescriptor): void {
    TypeDescriptor
      .forType(descriptor.type as any)
      .getMethods()
      .forEach(methodDesc =>
        this.calls.set(methodDesc.name, this.compileMethod(methodDesc))
      )
  }

  // -------------------------------------------------------
  // Compile a single method into a direct axios call.
  // Everything outside the returned lambda is compile-time work.
  // -------------------------------------------------------

  private compileMethod(methodDesc: MethodDescriptor): CompiledCall {

    // ── HTTP verb + path ──────────────────────────────────
    const httpDec = methodDesc.decorators.find(d =>
      d.decorator.name in HTTP_DECORATOR_TO_METHOD
    )

    const axiosMethod = HTTP_DECORATOR_TO_METHOD[httpDec?.decorator.name ?? ''] ?? 'GET'
    const rawPath     = (httpDec?.arguments[0] as string | undefined) ?? `/${methodDesc.name}`

    // ── Pre-split path tokens ─────────────────────────────
    const pathTokens = rawPath.split('/')

    // ── Param extractors — built once from JSON parameters ─
    const reflectedParams: ReflectedParameter[] = (methodDesc as any).parameters ?? []

    const extractors = reflectedParams.map(p => {
      const kindDec = p.decorators.find(d => d.name in PARAM_DECORATOR_TO_KIND)
      return {
        index: p.index,
        kind:  PARAM_DECORATOR_TO_KIND[kindDec?.name ?? ''] ?? 'query',
        data:  kindDec?.arguments[0] as string | undefined,
      }
    })

    // ── Return type — resolved once at compile time ────────
    // NOT inside .then() — that would re-resolve on every call
    const returnType = this.resolveReturnType(methodDesc)

    // ── The compiled call — hot path, zero metadata work ──
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
        if (!returnType)
          return response.data

        return Array.isArray(response.data)
          ? response.data.map((item: unknown) => plainToInstance(returnType, item))
          : plainToInstance(returnType, response.data)
      })
    }
  }

  // -------------------------------------------------------
  // Resolve unwrapped return type — called at compile time only
  // -------------------------------------------------------

  private resolveReturnType(methodDesc: MethodDescriptor): ClassConstructor<any> | undefined {
    const dec = methodDesc.getDecorator(Returns)
    if (dec)
      return dec.arguments[0] as ClassConstructor<any>

    if (!methodDesc.async && methodDesc.returnType !== Promise)
      return methodDesc.returnType

    return undefined
  }
}
