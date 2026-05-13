import {
  ClassDeclaration,
  MethodDeclaration,
  ParameterDeclaration,
} from 'ts-morph';

import { HTTP_DECORATORS, PARAM_DECORATORS } from './decorators';

import { ProxyMethod, ProxyParam } from './types';

import { stripQuotes } from './utils';

/* =========================================================
 * Controller extraction
 * ========================================================= */

export function extractController(cls: ClassDeclaration) {
  const controller = cls.getDecorator('Controller');

  if (!controller) return null;

  const basePath = stripQuotes(controller.getArguments()[0]?.getText()) ?? '';

  const schema: Record<string, any> = {
    basePath,
  };

  for (const method of cls.getMethods()) {
    const endpoint = extractMethod(method);

    if (!endpoint) continue;

    schema[method.getName()] = endpoint;
  }

  return {
    name: cls.getName() ?? 'AnonymousController',

    schema,
  };
}

/* =========================================================
 * Method extraction
 * ========================================================= */

function extractMethod(method: MethodDeclaration): ProxyMethod | null {
  for (const [decoratorName, httpMethod] of Object.entries(HTTP_DECORATORS)) {
    const decorator = method.getDecorator(decoratorName);

    if (!decorator) continue;

    const path = stripQuotes(decorator.getArguments()[0]?.getText()) ?? '';

    return {
      method: httpMethod,
      path,

      params: extractParams(method),
    };
  }

  return null;
}

/* =========================================================
 * Param extraction
 * ========================================================= */

function extractParams(method: MethodDeclaration): ProxyParam[] | undefined {
  const params: ProxyParam[] = [];

  const methodParams = method.getParameters();

  for (const param of methodParams) {
    const extracted = extractParam(param, methodParams.indexOf(param));

    if (extracted) params.push(extracted);
  }

  return params.length ? params : undefined;
}

function extractParam(
  param: ParameterDeclaration,
  index: number,
): ProxyParam | null {
  for (const decorator of param.getDecorators()) {
    const name = decorator.getName();

    const location = PARAM_DECORATORS[name as keyof typeof PARAM_DECORATORS];

    if (!location) continue;

    return {
      index,

      in: location,

      binding: stripQuotes(decorator.getArguments()[0]?.getText()),
    };
  }

  return null;
}
