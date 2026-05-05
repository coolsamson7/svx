import { TypeDescriptor } from "@svx/portal"

export const field = (): any => {
    return function (target: any, propertyKey: string) {
        TypeDescriptor.forType(target.constructor).addPropertyDecorator(target, propertyKey, field)
    }
}
