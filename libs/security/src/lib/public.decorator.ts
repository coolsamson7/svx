/** Marks a service method as publicly accessible — no session required. */
export function Public(): MethodDecorator {
  return (_target: any, _key: string | symbol, descriptor: PropertyDescriptor) => {
    descriptor.value.__public = true
    return descriptor
  }
}

export namespace Public {
  export function isOn(fn: Function): boolean {
    return (fn as any).__public === true
  }
}
