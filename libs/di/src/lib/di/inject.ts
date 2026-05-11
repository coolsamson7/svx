import { Environment } from "./di";

export const inject = <T>(env: Environment, type: new (...args: any[]) => T): T => {
  return env.get(type) as T;
};
