import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { plainToInstance, instanceToPlain, ClassConstructor } from 'class-transformer';
import { DeclareChannel, Channel, ServiceDescriptor } from './service';
import { TypeDescriptor, MethodDescriptor, Returns } from '../reflection';

/* =========================================================
 * constants
 * ========================================================= */

const HTTP_DECORATOR_TO_METHOD: Record<string, string> = {
  Get: 'GET',
  Post: 'POST',
  Put: 'PUT',
  Delete: 'DELETE',
  Patch: 'PATCH',
  Options: 'OPTIONS',
  Head: 'HEAD',
  All: 'GET',
}

const stripQuotes = (s: string) => s.replace(/^["']|["']$/g, '')

type CompiledCall = (args: any[]) => Promise<any>

/* =========================================================
 * compiled structures (fully precomputed)
 * ========================================================= */

type ParamKind = 'body' | 'param' | 'query'

interface CompiledParam {
  index: number
  kind: ParamKind
  key?: string
}

interface RequestPlan {
  method: string
  urlTemplate: string
  params: CompiledParam[]
  returnType?: ClassConstructor<any>
}

/* =========================================================
 * RestChannel
 * ========================================================= */

@DeclareChannel('rest')
@Injectable()
export class RestChannel implements Channel {
  url?: string

  private calls = new Map<string, CompiledCall>()

  constructor(private readonly http: HttpService) {}

  /* =========================================================
   * entry point
   * ========================================================= */

  call(descriptor: ServiceDescriptor, method: string, ...args: any[]): Promise<any> {
    if (this.calls.size === 0)
      this.compileAll(descriptor)

    const fn = this.calls.get(method)
    if (!fn)
      throw new Error(`No REST mapping for '${method}' on service '${descriptor.name}'`)

    return fn(args)
  }

  /* =========================================================
   * compile all once
   * ========================================================= */

  private compileAll(descriptor: ServiceDescriptor): void {
    const type = TypeDescriptor.forType(descriptor.type as any)

    const controller = type.decorators.find(d => d.decorator.name === 'Controller')
    const prefix = controller ? stripQuotes(controller.arguments[0] as string) : ''

    for (const method of type.getMethods()) {
      const plan = this.compile(method, prefix)
      this.calls.set(method.name, this.createExecutor(plan))
    }
  }

  /* =========================================================
   * COMPILATION PHASE (no runtime logic survives)
   * ========================================================= */

  private compile(method: MethodDescriptor, prefix: string): RequestPlan {

    const http = method.decorators.find(d =>
      d.decorator.name in HTTP_DECORATOR_TO_METHOD
    )

    const httpMethod = HTTP_DECORATOR_TO_METHOD[http?.decorator.name ?? ''] ?? 'GET'

    const basePath =
      http?.arguments?.[0]
        ? stripQuotes(http.arguments[0] as string)
        : method.name

    const urlTemplate = `/${prefix}/${basePath}`.replace(/\/+/g, '/')

    const params: CompiledParam[] = []

    for (const p of method.parameters) {
      const dec = p.decorators.find(d =>
        ['Body', 'Param', 'Query'].includes(d.decorator.name)
      )

      if (!dec || dec.decorator.name === 'Query') {
        params.push({ index: p.index, kind: 'query', key: dec?.arguments?.[0] ?? p.name })
      }

      else if (dec.decorator.name === 'Param') {
        params.push({ index: p.index, kind: 'param', key: dec.arguments?.[0] ?? p.name })
      }

      else if (dec.decorator.name === 'Body') {
        params.push({ index: p.index, kind: 'body' })
      }
    }

    return {
      method: httpMethod,
      urlTemplate,
      params,
      returnType: this.resolveReturnType(method),
    }
  }

  /* =========================================================
   * EXECUTION COMPILATION (flat, no branching logic per call)
   * ========================================================= */

  private createExecutor(plan: RequestPlan): CompiledCall {

    return async (args: any[]) => {

      let url = plan.urlTemplate
      const query: Record<string, any> = {}
      let body: any

      // PURE LOOP over compiled descriptors (no metadata, no decorators)
      for (const p of plan.params) {

        const value = args[p.index]

        if (p.kind === 'body') {
          body = instanceToPlain(value)
        }

        else if (p.kind === 'param') {
          url = url.replace(`:${p.key}`, encodeURIComponent(value))
        }

        else if (p.kind === 'query') {
          query[p.key!] = value
        }
      }

      const res = await firstValueFrom(
        this.http.request({
          method: plan.method,
          url: `${this.url}${url}`,
          params: query,
          data: body,
        })
      )

      if (!plan.returnType)
        return res.data

      return Array.isArray(res.data)
        ? res.data.map((x: any) => plainToInstance(plan.returnType!, x))
        : plainToInstance(plan.returnType!, res.data)
    }
  }

  /* =========================================================
   * return type resolution (compile-time only)
   * ========================================================= */

  private resolveReturnType(method: MethodDescriptor): ClassConstructor<any> | undefined {
    const dec = method.getDecorator(Returns)
    if (dec) return dec.arguments[0] as ClassConstructor<any>

    if (!method.async && method.returnType !== Promise)
      return method.returnType

    return undefined
  }
}
