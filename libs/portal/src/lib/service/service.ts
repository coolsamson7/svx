import {
  Module,
  Injectable,
  Inject,
  DynamicModule,
  Provider,
} from "@nestjs/common";
import { TypeDescriptor } from "../reflection";

function getMethodNames(token: any): string[] {
  const td = TypeDescriptor.forType(token)
  return Object.getOwnPropertyNames(token.prototype)
    .filter(
      (m) =>
        m !== "constructor" &&
        typeof token.prototype[m] === "function"
    );
}

/* ============================================================
   🧩 1. TYPES
============================================================ */

interface ComponentOptions {
  services: any[];
  endpoint: string;
}

/* ============================================================
   🧠 2. METADATA + DECORATORS
============================================================ */

const COMPONENT_META_KEY = "custom:component";

export function Component(options: ComponentOptions): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(COMPONENT_META_KEY, options, target);
  };
}

export function getComponentMetadata(target: any): ComponentOptions {
  return Reflect.getMetadata(COMPONENT_META_KEY, target);
}

// custom injection decorator
export function InjectService(token: any) {
  return Inject(token);
}

/* ============================================================
   🌐 3. PROXY (REMOTE TRANSPORT)
============================================================ */

function createComponentProxy<T extends object>(
  serviceToken: any,
  endpoint: string,
  allowedMethods: string[]
): T {
  return new Proxy(
    {},
    {
      get(_, prop: string | symbol) {
        if (typeof prop !== "string") return undefined;

        // 🛑 block framework + JS internals
        if (
          prop === "then" ||
          prop === "catch" ||
          prop === "finally" ||
          prop === "onModuleInit" ||
          prop === "onModuleDestroy" ||
          prop === "constructor"
        ) {
          return undefined;
        }

        // 🛑 only allow real service methods
        if (!allowedMethods.includes(prop)) {
          return undefined;
        }

        return async (...args: any[]) => {
          const res = await fetch(
            `${endpoint}/${serviceToken.name}/${prop}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(args),
            }
          );

          if (!res.ok) {
            throw new Error(
              `Remote call failed: ${serviceToken.name}.${prop}`
            );
          }

          return res.json();
        };
      },
    }
  ) as T;
}

/* ============================================================
   🧱 4. DYNAMIC MODULE FACTORY
============================================================ */

export function createComponentModule(component: any) {
  const meta = getComponentMetadata(component);

  const providers = meta.services.map((token: any) => ({
    provide: token,
    useFactory: () =>
      createComponentProxy(
        token,
        meta.endpoint,
        getMethodNames(token) // or your ts-morph methods
      ),
  }));

  return {
    module: component,
    providers,
    exports: providers,
  };
}
