export interface ProxyParam {
  index: number;
  in: 'path' | 'query' | 'body' | 'header';
  binding?: string;
}

export interface ProxyMethod {
  method: string;
  path: string;
  params?: ProxyParam[];
}

export interface ProxyService {
  basePath: string;
  [methodName: string]: any;
}

export type ProxySchema = Record<string, ProxyService>;
