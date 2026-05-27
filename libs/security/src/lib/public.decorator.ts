import { TypeDescriptor } from '@svx/common'

/** Marks a service method as publicly accessible — no session required. */
export function Public(): MethodDecorator {
  return (target: any, key: string | symbol, descriptor: PropertyDescriptor) => {
    TypeDescriptor.forType(target.constructor).addMethodDecorator(target, key.toString(), Public as any)
    return descriptor
  }
}
