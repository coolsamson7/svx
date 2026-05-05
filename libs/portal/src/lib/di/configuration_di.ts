import "reflect-metadata";


import { ConfigurationManager } from "../configuration";
import { AnnotationResolver, Environment, injectable } from "./di";

export class ConfigValue {
  constructor(
    public readonly key: string,
    public readonly default_: any = undefined,
  ) {}

  toString(): string {
    return `config('${this.key}')`;
  }
}

export function config(key: string, defaultValue?: any): ParameterDecorator {
  return (target: object, propertyKey: string | symbol | undefined, parameterIndex: number) => {
    const clazz  = propertyKey == null ? target as any : (target as any).constructor;
    const metaKey = propertyKey == null ? `param:${parameterIndex}` : `${String(propertyKey)}:param:${parameterIndex}`;

    const existing: any[] = Reflect.getMetadata('annotations', clazz, metaKey) || [];
    existing.unshift(new ConfigValue(key, defaultValue));
    Reflect.defineMetadata('annotations', existing, clazz, metaKey);
  };
}

@injectable({module: "boot"})
export class ConfigAnnotationResolver extends AnnotationResolver<any> {
  // constructor

  constructor() {
    super(ConfigValue);
  }

  // private

  private coerce(value: any, targetType: any): any {
  if (value == null) return value;

  // Already correct type
  if (value instanceof targetType) return value;

  // String
  if (targetType === String) {
    return String(value);
  }

  // Number
  if (targetType === Number) {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const n = Number(value);
      if (!isNaN(n)) return n;
    }
    throw new Error(`Cannot coerce "${value}" to number`);
  }

  // Boolean
  if (targetType === Boolean) {
    if (typeof value === "boolean") return value;

    if (typeof value === "string") {
      const normalized = value.toLowerCase().trim();
      if (["true", "1", "yes", "y"].includes(normalized)) return true;
      if (["false", "0", "no", "n"].includes(normalized)) return false;
    }

    if (typeof value === "number") {
      return value !== 0;
    }

    throw new Error(`Cannot coerce "${value}" to boolean`);
  }

  // Enum support
  if (typeof targetType === "object") {
    const enumValues = Object.values(targetType);
    if (enumValues.includes(value)) return value;

    // allow string name lookup
    if (typeof value === "string" && targetType[value] !== undefined) {
      return targetType[value];
    }

    throw new Error(`Cannot coerce "${value}" to enum`);
  }

  // JSON object coercion
  if (targetType === Object && typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`Cannot parse JSON from "${value}"`);
    }
  }

  // Class constructor (advanced case)
  if (typeof targetType === "function") {
    return new targetType(value);
  }

  return value;
}

  // override

  override dependencies(): any[] {
    return [ConfigurationManager]; 
  }

  override resolve(annotationValue: ConfigValue, paramType: any, environment: Environment, ...deps: any[]): any {
    const rawValue = environment.get(ConfigurationManager).get(annotationValue.key, annotationValue.default_);

    return this.coerce(rawValue, paramType);
  }
}
