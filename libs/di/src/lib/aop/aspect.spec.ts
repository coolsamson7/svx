import "reflect-metadata"

import { methods } from "./aspect-target"
import { ConsoleTrace, TraceLevel, Tracer } from "@svx/common"

import { Invocation } from "./invocation"
import { AspectType } from "./aspect-type.enum"
import { Environment, injectable, Module, module } from "../di"

 new Tracer({
    enabled: true,
    trace: new ConsoleTrace('%d [%p]: %m\n'), // %f
    paths: {
        aop: TraceLevel.OFF,
        di: TraceLevel.OFF,
    },
});

@injectable()
class TestClass {
    sync(): number {
        return 1
    }

    async promise(): Promise<number> {
        return Promise.resolve(1)
    }

    error(): number {
        throw new Error("ouch")
    }

    async promiseError(): Promise<number> {
        return Promise.reject("async ouch")
    }
}

@module()
class TestModule extends Module {
}

@injectable()
class Aspects {
    message = "aspect"

    nBefore = 0
    nAround = 0
    nAfter = 0
    nError = 0
    nPromiseError = 0

    @before(methods().named("sync", "promise"))
    beforeMethod(invocation: Invocation) {
        this.nBefore++
        console.log("before(" + invocation.method().name + ")")
    }

    @aspect({
        type: AspectType.AROUND,
        target: methods().named("sync"),
    })
    aroundMethod(invocation: Invocation): any {
        this.nAround++

        try {
            console.log("> around(" + invocation.method().name + ")")

            return invocation.proceed()
        }
        finally {
            console.log("< around(" + invocation.method().name + ")")
        }
    }

    @aspect({
        type: AspectType.AROUND,
        target: methods().thatAreAsync(),
    })
    async aroundAsyncMethod(invocation: Invocation): Promise<any> {
        this.nAround++

        console.log("> async around(" + invocation.method().name + ")")

        try {
            return await invocation.proceed() // do we need that?
        }
        finally {
            console.log("< around(" + invocation.method().name + ")")
        }
    }

    @after(methods().named("sync", "promise"))
    afterMethod(invocation: Invocation) {
        this.nAfter++
        console.log("after(" + invocation.method().name + ")")
    }

    @error(methods().of(TestClass).named("error").matching("error.*"))
    error(invocation: Invocation) {
        this.nError++
    }

    @error(methods().named("promiseError"))
    promiseError(invocation: Invocation) {
        this.nPromiseError++
    }
}

import { AdviceProcessor } from "./advice-processor"
import { after, aspect, before, error } from "./aspect"

const a = AdviceProcessor;

describe("aspects", () => {
    let environment : Environment
    let aspect : Aspects

    beforeEach(() => {
        environment = new Environment({module: TestModule})

        aspect = environment.get(Aspects)
    })

    it("sync should work", async () => {
        const testClass = environment.get(TestClass)
        const result = testClass.sync()

        expect(result).toBe(1)

        expect(aspect.nBefore).toBe(1)
        expect(aspect.nAfter).toBe(1)
        expect(aspect.nAround).toBe(1)
    })

    it("sync error should work", () => {
        try {
            environment.get(TestClass).error()

            //fail("should not happen")
        }
        catch (error : any) {
            expect(error.toString()).toContain("ouch")
        }
    })

    it("async should work", async () => {
        const result = await environment.get(TestClass).promise()

        expect(result).toBe(1)
    })

    it("async error should work", async () => {
        try {
            const error = await  environment.get(TestClass).promiseError()
            // that's the current logic: handled errors are fine...is that ok???

            expect(aspect.nAround).toBe(1)
            expect(aspect.nPromiseError).toBe(1)
        }
        catch (error: any) {
            expect("should not happen").toBe("")
        }
    })
})
