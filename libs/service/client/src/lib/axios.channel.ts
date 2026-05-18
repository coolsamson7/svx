/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosInstance, isAxiosError }                from 'axios'
import { plainToInstance, instanceToPlain, ClassConstructor } from 'class-transformer'
import { TypeDescriptor, MethodDescriptor, Returns, ErrorManager, ErrorContext, CommunicationError, ServerError } from '@svx/common'
import { Channel, ChannelFactory, ServiceDescriptor }        from '@svx/service-common'
import { injectable } from '@svx/di';

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

const stripQuotes = (s: string) => s.replace(/^["']|["']$/g, '')

// Compiled function types

type Args            = any[]
type UrlBuilder      = (args: Args) => string
type BodyExtractor   = (args: Args) => any
type QueryExtractor  = (args: Args) => Record<string, any> | undefined
type ResponseHandler = (data: any) => any
type CompiledCall    = (args: Args) => Promise<any>


@injectable()
export class AxiosChannelFactory implements ChannelFactory<AxiosRestChannel> {
  // constructor

  constructor(private errorManager: ErrorManager) {
  }

  // implement

  create(url: string) {
    return new AxiosRestChannel(url, this.errorManager);
  }
}


export class AxiosRestChannel implements Channel {
  // static

  private static schemas = new Map<string, ProxyService>();

  static loadReflection(data: ProxySchema): void {
    for (const [name, service] of Object.entries(data))
      AxiosRestChannel.schemas.set(name, service);
  }

  // instance

  private axios: AxiosInstance;
  private readonly calls = new Map<string, CompiledCall>();
  private readonly compilations = new Map<string, Promise<void>>();
  private tokenProvider?: { getToken(): Promise<string | undefined> };

  // constructor

  constructor(
    public url: string,
    private errorManager: ErrorManager,
  ) {
    this.axios = axios.create({
      baseURL: url,
      headers: { 'content-type': 'application/json' },
    });
    this.attachErrorInterceptor();
    if (this.tokenProvider) this.attachInterceptor();
  }

  // private

  private attachErrorInterceptor(): void {
    this.axios.interceptors.response.use(undefined, (error: unknown) => {
      if (isAxiosError(error)) {
        if (error.response) {
          const data = error.response.data as any;
          throw new ServerError(
            data?.class ?? data?.error ?? 'HttpError',
            data?.message ?? error.message,
            error,
          );
        }
        throw new CommunicationError(error.message, error);
      }
      throw error;
    });
  }

  setTokenProvider(provider: {
    getToken(): Promise<string | undefined>;
  }): void {
    this.tokenProvider = provider;
    if (this.axios != null) this.attachInterceptor();
  }

  private attachInterceptor(): void {
    this.axios.interceptors.request.use(async (config) => {
      const token = await this.tokenProvider!.getToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
  }

  // implement Channel

  async call(
    descriptor: ServiceDescriptor,
    method: string,
    ...args: any[]
  ): Promise<any> {
    let compile = this.compilations.get(descriptor.name);
    if (!compile) {
      compile = this.compileAll(descriptor);
      this.compilations.set(descriptor.name, compile);
    }
    await compile;

    const fn = this.calls.get(method);
    if (!fn)
      throw new Error(
        `No REST mapping for '${method}' on service '${descriptor.name}'`,
      );

    try {
      return await fn(args);
    } catch (e: any) {
      if (this.errorManager) {
        const context: ErrorContext = {
          $type: 'http',
          service: descriptor.name,
          method,
        };
        throw this.errorManager.handle(e, context);
      }
      throw e;
    }
  }

  // private

  private async compileAll(descriptor: ServiceDescriptor): Promise<void> {
    const componentName = (descriptor as any).componentDescriptor?.name;
    if (componentName) {
      const { data } = await this.axios.get(
        `/${componentName}/channel-metadata`,
        { params: { channel: 'rest' } },
      );
      const service =
        (data as ProxySchema)[(descriptor.type as any).name] ??
        (data as ProxySchema)[descriptor.name];
      if (service) {
        this.compileService(
          service,
          TypeDescriptor.forType(descriptor.type as any),
        );
        return;
      }
    }

    const staticService =
      AxiosRestChannel.schemas.get((descriptor.type as any).name) ??
      AxiosRestChannel.schemas.get(descriptor.name);
    if (staticService) {
      this.compileService(
        staticService,
        TypeDescriptor.forType(descriptor.type as any),
      );
      return;
    }

    const typeDesc = TypeDescriptor.forType(descriptor.type as any);
    const controller = typeDesc.decorators.find(
      (d) => d.decorator.name === 'Controller',
    );
    const prefix = controller
      ? stripQuotes(controller.arguments[0] as string)
      : '';
    for (const method of typeDesc.getMethods())
      this.calls.set(method.name, this.compileMethod(method, prefix));
  }

  private compileService(
    service: ProxyService,
    typeDesc: ReturnType<typeof TypeDescriptor.forType>,
  ): void {
    const { basePath, ...methodEntries } = service;
    for (const [name, entry] of Object.entries(methodEntries))
      this.calls.set(
        name,
        this.compileFromProxy(
          entry as ProxyMethod,
          basePath as string,
          typeDesc.getMethod(name),
        ),
      );
  }

  private compileFromProxy(
    proxy: ProxyMethod,
    basePath: string,
    method?: MethodDescriptor,
  ): CompiledCall {
    const template =
      `/${basePath}/${proxy.path}`.replace(/\/+/g, '/').replace(/\/$/, '') ||
      '/';

    const pathParams: { index: number; key: string }[] = [];
    const queryParams: { index: number; key: string }[] = [];
    let bodyIndex: number | undefined;

    for (const p of proxy.params ?? []) {
      if (p.in === 'path')
        pathParams.push({ index: p.index, key: p.binding ?? `arg${p.index}` });
      else if (p.in === 'body') bodyIndex = p.index;
      else if (p.in === 'query')
        queryParams.push({ index: p.index, key: p.binding ?? `arg${p.index}` });
    }

    const buildUrl = this.makeUrlBuilder(template, pathParams);
    const extractBody = this.makeBodyExtractor(bodyIndex);
    const extractQuery = this.makeQueryExtractor(queryParams);
    const handleResponse = this.makeResponseHandler(
      method ? this.resolveReturnType(method) : undefined,
    );
    const http = this.axios;

    return async (args: Args): Promise<any> => {
      const { data } = await http.request({
        method: proxy.method,
        url: buildUrl(args),
        params: extractQuery(args),
        data: extractBody(args),
      });
      return handleResponse(data);
    };
  }

  private compileMethod(
    method: MethodDescriptor,
    prefix: string,
  ): CompiledCall {
    const httpDec = method.decorators.find(
      (d) => d.decorator.name in HTTP_DECORATOR_TO_METHOD,
    );
    const httpMethod =
      HTTP_DECORATOR_TO_METHOD[httpDec?.decorator.name ?? ''] ?? 'GET';
    const basePath = httpDec?.arguments?.length
      ? stripQuotes(httpDec.arguments[0] as string)
      : '';
    const template =
      `/${prefix}/${basePath}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

    const pathParams: { index: number; key: string }[] = [];
    const queryParams: { index: number; key: string }[] = [];
    let bodyIndex: number | undefined;

    for (const p of method.parameters) {
      const dec = p.decorators.find((d) =>
        ['Body', 'Param', 'Query'].includes(d.decorator.name),
      );
      if (!dec || dec.decorator.name === 'Query')
        queryParams.push({
          index: p.index,
          key: dec?.arguments?.[0] ?? p.name,
        });
      else if (dec.decorator.name === 'Param')
        pathParams.push({ index: p.index, key: dec.arguments?.[0] ?? p.name });
      else if (dec.decorator.name === 'Body') bodyIndex = p.index;
    }

    const buildUrl = this.makeUrlBuilder(template, pathParams);
    const extractBody = this.makeBodyExtractor(bodyIndex);
    const extractQuery = this.makeQueryExtractor(queryParams);
    const handleResponse = this.makeResponseHandler(
      this.resolveReturnType(method),
    );
    const http = this.axios;

    return async (args: Args): Promise<any> => {
      const { data } = await http.request({
        method: httpMethod,
        url: buildUrl(args),
        params: extractQuery(args),
        data: extractBody(args),
      });
      return handleResponse(data);
    };
  }

  // ── Function factories ────────────────────────────────────

  private makeUrlBuilder(
    template: string,
    pathParams: { index: number; key: string }[],
  ): UrlBuilder {
    if (pathParams.length === 0) return () => template;

    const segments: Array<string | ((args: Args) => string)> = template
      .split('/')
      .map((seg) => {
        if (!seg.startsWith(':')) return seg;
        const p = pathParams.find((p) => p.key === seg.slice(1));
        return p ? (args: Args) => encodeURIComponent(args[p.index]) : seg;
      });

    return (args: Args) =>
      segments.map((s) => (typeof s === 'function' ? s(args) : s)).join('/');
  }

  private makeBodyExtractor(bodyIndex: number | undefined): BodyExtractor {
    if (bodyIndex === undefined) return () => undefined;
    return (args: Args) => instanceToPlain(args[bodyIndex!]);
  }

  private makeQueryExtractor(
    queryParams: { index: number; key: string }[],
  ): QueryExtractor {
    if (queryParams.length === 0) return () => undefined;
    if (queryParams.length === 1) {
      const { index, key } = queryParams[0];
      return (args: Args) => ({ [key]: args[index] });
    }
    return (args: Args) => {
      const q: Record<string, any> = {};
      for (const p of queryParams) q[p.key] = args[p.index];
      return q;
    };
  }

  private makeResponseHandler(
    returnType?: ClassConstructor<any>,
  ): ResponseHandler {
    if (!returnType) return (data) => data;
    return (data) =>
      Array.isArray(data)
        ? data.map((x: any) => plainToInstance(returnType, x))
        : plainToInstance(returnType, data);
  }

  private resolveReturnType(
    method: MethodDescriptor,
  ): ClassConstructor<any> | undefined {
    const dec = method.getDecorator(Returns);
    if (dec) return dec.arguments[0] as ClassConstructor<any>;
    if (!method.async && method.returnType !== Promise)
      return method.returnType;
    return undefined;
  }
}
