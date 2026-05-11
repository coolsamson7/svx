/* eslint-disable @typescript-eslint/no-explicit-any */
import { TypeDescriptor, MethodDescriptor } from '@svx/common'
import { Service, AbstractType }            from './service-common'

export type MethodHandler = (name: string, ...args: any[]) => any

export class ProxyBuilder<T extends Service> {
  // instance data

  private readonly _proxy : any
  private readonly _methods: MethodDescriptor[]

  // constructor

  constructor(type: AbstractType<T>) {
    this._proxy   = Object.create((type as any).prototype)
    this._methods = TypeDescriptor.forType(type as any).getMethods()
  }

  // public

  get methods(): MethodDescriptor[] {
    return this._methods
  }

  // ── bind: assign all method stubs to a single handler ────
  // handler receives (methodName, ...args) — called on every invocation
  bind(handler: MethodHandler): this {
    for (const method of this._methods) {
      const name = method.name
      this._proxy[name] = (...args: any[]) => handler(name, ...args)
    }
    return this
  }

  // ── lazy: first call to any method triggers init() ───────
  // init() is expected to call bind(), replacing all stubs.
  // The triggering call is then re-dispatched to the new stub.
  lazy(init: () => void): this {
    for (const method of this._methods) {
      const name = method.name
      this._proxy[name] = (...args: any[]) => {
        init()                               // replaces all stubs via bind()
        return (this._proxy as any)[name](...args)  // re-call the new stub
      }
    }
    return this
  }

  build(): T {
    return this._proxy as T
  }
}
