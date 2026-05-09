import { Injectable, Scope } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { plainToInstance, instanceToPlain, ClassConstructor } from 'class-transformer';
import { DeclareChannel, Channel, ServiceDescriptor } from './service';
import { TypeDescriptor, MethodDescriptor, Returns } from '../reflection';

/* =========================================================
 * NestJS metadata keys & enums
 * ========================================================= */

const PATH_METADATA       = 'path';
const METHOD_METADATA     = 'method';
const ROUTE_ARGS_METADATA = '__routeArguments__';

const enum HttpMethod {
  GET     = 0,
  POST    = 1,
  PUT     = 2,
  DELETE  = 3,
  PATCH   = 4,
  ALL     = 5,
  OPTIONS = 6,
  HEAD    = 7,
}

const enum ParamType {
  BODY    = 3,
  QUERY   = 4,
  PARAM   = 5,
  HEADERS = 6,
}

const HTTP_METHOD_MAP: Record<number, string> = {
  [HttpMethod.GET]:     'GET',
  [HttpMethod.POST]:    'POST',
  [HttpMethod.PUT]:     'PUT',
  [HttpMethod.DELETE]:  'DELETE',
  [HttpMethod.PATCH]:   'PATCH',
  [HttpMethod.OPTIONS]: 'OPTIONS',
  [HttpMethod.HEAD]:    'HEAD',
  [HttpMethod.ALL]:     'GET',
};

/* =========================================================
 * Compiled param extractor
 * Each instance is built ONCE at compile time and reused.
 * ========================================================= */

interface ParamExtractor {
  index:     number;
  type:      ParamType;
  data:      string | undefined;      // param name / query key / header name
  paramType: ClassConstructor<any>;   // TypeScript type → class-transformer
}

type CompiledCall = (...args: any[]) => Promise<any>;

/* =========================================================
 * RestChannel
 * ========================================================= */

@DeclareChannel('rest')
@Injectable({ scope: Scope.TRANSIENT })
export class RestChannel implements Channel {
  url?: string;

  // populated once on first call() — zero overhead afterwards
  private calls = new Map<string, CompiledCall>();

  constructor(private readonly http: HttpService) {}

  // -------------------------------------------------------
  // Channel
  // -------------------------------------------------------

  call(descriptor: ServiceDescriptor, method: string, ...args: any[]): Promise<any> {
    if (this.calls.size === 0)
      this.compileAll(descriptor);

    const fn = this.calls.get(method);
    if (!fn)
      throw new Error(`No REST mapping for '${method}' on service '${descriptor.name}'`);

    return fn(...args);
  }

  // -------------------------------------------------------
  // Compile all methods from TypeDescriptor — runs once
  // -------------------------------------------------------

  private compileAll(descriptor: ServiceDescriptor): void {
    TypeDescriptor
      .forType(descriptor.type as any)
      .getMethods()
      .forEach(methodDesc => {
        this.calls.set(methodDesc.name, this.compileMethod(descriptor, methodDesc));
      });
  }

  // -------------------------------------------------------
  // Compile a single MethodDescriptor into a direct axios call.
  // Everything above the returned lambda runs at compile time only.
  // -------------------------------------------------------

  private compileMethod(descriptor: ServiceDescriptor, methodDesc: MethodDescriptor): CompiledCall {
    const proto = (descriptor.type as any).prototype;
    const ctor  =  descriptor.type as any;

    // ── HTTP verb + path ──────────────────────────────────────────────
    const httpMethod: number =
      Reflect.getMetadata(METHOD_METADATA, proto, methodDesc.name) ?? HttpMethod.GET;
    const rawPath: string =
      Reflect.getMetadata(PATH_METADATA,   proto, methodDesc.name) ?? `/${methodDesc.name}`;

    const axiosMethod = HTTP_METHOD_MAP[httpMethod] ?? 'GET';

    // ── NestJS route args: { '3:0': { index, data }, '5:1': ... }
    //    key format = `${RouteParamtypes}:${argIndex}`  ───────────────
    const rawRouteArgs: Record<string, { index: number; data: any }> =
      Reflect.getMetadata(ROUTE_ARGS_METADATA, ctor, methodDesc.name) ?? {};

    // ── Pair NestJS route args with TypeScript param types
    //    from MethodDescriptor.paramTypes (design:paramtypes)
    //    so class-transformer can do its job  ────────────────────────
    const extractors: ParamExtractor[] = Object.entries(rawRouteArgs)
      .map(([key, meta]) => ({
        index:     meta.index,
        type:      parseInt(key.split(':')[0], 10) as ParamType,
        data:      meta.data,
        paramType: methodDesc.paramTypes[meta.index],  // ← from MethodDescriptor
      }))
      .sort((a, b) => a.index - b.index);

    // ── Return type for response deserialization ──────────────────────
    // design:returntype yields Promise for async methods.
    // @Returns(User) on the MethodDescriptor carries the actual type.
    const returnType = this.resolveReturnType(methodDesc);

    // ── Pre-split path tokens once at compile time ────────────────────
    const pathTokens = rawPath.split('/');

    // ── The compiled call ─────────────────────────────────────────────
    // This is the only thing that runs on every RPC call.
    // No reflection, no metadata reads, no string splits.

    return (...args: any[]): Promise<any> => {
      const pathParams: Record<string, string> = {};
      const query:      Record<string, any>    = {};
      const headers:    Record<string, any>    = {};
      let   body:       any                    = undefined;

      for (const ex of extractors) {
        const raw = args[ex.index];

        switch (ex.type) {
          case ParamType.BODY:
            // serialize with class-transformer — respects @Exclude(), @Transform(), etc.
            body = instanceToPlain(raw);
            break;

          case ParamType.PARAM:
            if (ex.data)
              pathParams[ex.data] = encodeURIComponent(raw);
            else if (typeof raw === 'object')
              for (const [k, v] of Object.entries(raw as object))
                pathParams[k] = encodeURIComponent(String(v));
            break;

          case ParamType.QUERY:
            if (ex.data) query[ex.data] = raw;
            else Object.assign(query, raw);
            break;

          case ParamType.HEADERS:
            if (ex.data) headers[ex.data] = raw;
            else Object.assign(headers, raw);
            break;
        }
      }

      const resolvedPath = pathTokens
        .map(seg => seg.startsWith(':') ? (pathParams[seg.slice(1)] ?? seg) : seg)
        .join('/');

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
          return response.data;

        // deserialize with class-transformer — respects @Expose(), @Transform(), etc.
        return Array.isArray(response.data)
          ? response.data.map((item: unknown) => plainToInstance(returnType, item))
          : plainToInstance(returnType, response.data);
      });
    };
  }

  // -------------------------------------------------------
  // Resolve unwrapped return type via MethodDescriptor
  //
  // design:returntype gives Promise for async methods, so we
  // use @Returns(User) to carry the actual inner type.
  // For sync methods returnType is directly usable.
  // -------------------------------------------------------

  private resolveReturnType(methodDesc: MethodDescriptor): ClassConstructor<any> | undefined {
    // check @Returns() decorator registered in TypeDescriptor
    const dec = methodDesc.getDecorator(Returns);
    if (dec)
      return dec.arguments[0] as ClassConstructor<any>;

    // sync method — returnType is the real type, not Promise
    if (!methodDesc.async && methodDesc.returnType !== Promise)
      return methodDesc.returnType;

    return undefined;
  }
}