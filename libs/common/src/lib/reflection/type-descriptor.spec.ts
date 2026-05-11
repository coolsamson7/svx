import "reflect-metadata"

import { TypeDescriptor } from "./type-descriptor"

import { ConsoleTrace, TraceLevel, Tracer } from "../tracer"

new Tracer({
    enabled: false,
    trace: new ConsoleTrace("%d [%p]: %m\n"), // d(ate), l(evel), p(ath), m(message)
    paths: {
        type: TraceLevel.FULL,
    },
});


const typeDecorator = (): any => {
    return function create(target: any) {
        TypeDescriptor.forType(target).addDecorator(typeDecorator)
    }
}
const methodDecorator = function (test: string): any {
    return (target: any, property: string, _descriptor: PropertyDescriptor) => {
        TypeDescriptor.forType(target.constructor).addMethodDecorator(target, property, methodDecorator, test)
    }
}

const propertyDecorator = (): any => {
    return function (target: any, propertyKey: string) {
        TypeDescriptor.forType(target.constructor).addPropertyDecorator(target, propertyKey, propertyDecorator)
    }
}

class Base {
    @propertyDecorator()
    base = ""

    @methodDecorator("test")
    f() {
        // noop
    }
}

@typeDecorator()
class Test extends Base {
    @propertyDecorator()
    id = ""

    @methodDecorator("test")
    async foo(message: string): Promise<string> {
        return Promise.resolve(message)
    }
    @methodDecorator("test")
    bar(): void {
        // noope
    }

    override f() {
            // noop
    }

    baz(): Promise<number> {
        return Promise.resolve<number>(1)
    }
}

describe("TypeDescriptor", () => {
    it("should analyze", () => {
        const descriptor = TypeDescriptor.forType(Test)

        console.log(descriptor)

        // descriptor

        expect(descriptor.decorators.length).toBe(1)
        expect(descriptor.decorators[0].decorator).toBe(typeDecorator)

        // property descriptor

        const fooDescriptor = descriptor.getMethod("foo")!

        expect(fooDescriptor.decorators.length).toBe(1)
        expect(fooDescriptor.decorators[0].decorator).toBe(methodDecorator)
        expect(fooDescriptor.async).toBe(true)

        // field descriptor

        const idDescriptor = descriptor.getField("id")!

        expect(idDescriptor.decorators.length).toBe(1)
        expect(idDescriptor.decorators[0].decorator).toBe(propertyDecorator)

        // methods

        const methods = descriptor.getMethods()

        //expect(methods.length).toBe(4)

        // properties

        const properties = descriptor.getProperties()

        //expect(properties.length).toBe(1)
    })
})
