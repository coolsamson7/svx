/**
 * the type of a constructor
 */
export type Constructor<T> = { new(...args: unknown[]): T }

export type GConstructor<T = any> = new (...args: any[]) => T;

export type ConstructorFunction<T> = new (...args: any[]) => T

export declare interface GType<T> extends Function {
  new (...args: any[]): T;
}

export type AbstractType<T> = abstract new (...args: any[]) => T;
