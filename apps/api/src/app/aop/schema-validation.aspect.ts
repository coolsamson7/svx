import { Injectable } from '@nestjs/common';
import { before, Invocation, methods } from '@svx/di';
import { DeclareService } from '@svx/service-common';
import { getImplementingSchema } from '@svx/common';

@Injectable()
export class SchemaValidationAspect {
  // (ctor, methodName) → one validator per arg index, null means no check
  private readonly _cache = new Map<
    Function,
    Map<string, Array<((v: any) => void) | null>>
  >();

  @before(methods().classDecoratedWith(DeclareService as any))
  validateArgs(invocation: Invocation): void {
    const ctor = (invocation.target as any).constructor as Function;
    const name = invocation.method().name;
    const checks = this.checksFor(ctor, name);
    const args = invocation.args ?? [];

    for (let i = 0; i < checks.length; i++) {
      const check = checks[i];
      if (check && args[i] != null) check(args[i]);
    }
  }

  private checksFor(
    ctor: Function,
    methodName: string,
  ): Array<((v: any) => void) | null> {
    let byMethod = this._cache.get(ctor);
    if (!byMethod) {
      byMethod = new Map();
      this._cache.set(ctor, byMethod);
    }

    let checks = byMethod.get(methodName);
    if (!checks) {
      checks = this.buildChecks(ctor, methodName);
      byMethod.set(methodName, checks);
    }

    return checks;
  }

  private buildChecks(
    ctor: Function,
    methodName: string,
  ): Array<((v: any) => void) | null> {
    const methodDesc = this.findMethodDesc(ctor, methodName);
    if (!methodDesc?.params?.length) return [];

    return methodDesc.params.map((param: any) => {
      const schema = this.schemaFor(param?.ref);
      return schema ? (v: any) => schema.validate(v) : null;
    });
  }

  private findMethodDesc(ctor: any, methodName: string): any {
    let c = ctor;
    while (c && c !== Object.prototype) {
      const found = c._descriptor?.methods?.find(
        (m: any) => m.name === methodName,
      );
      if (found) return found;
      c = Object.getPrototypeOf(c);
    }
    return null;
  }

  private schemaFor(ref: any): { validate: (v: any) => void } | null {
    if (!ref) return null;
    const t = ref.t?.();
    if (!t) return null;

    // type-only import resolves to the schema object directly
    if (typeof t === 'object' && typeof t.validate === 'function') return t;

    // class decorated with @Implements(schema)
    if (typeof t === 'function') return getImplementingSchema(t) ?? null;

    return null;
  }
}
