import "reflect-metadata"

import { Tracer } from "./tracer"
import { TraceLevel } from "./trace-level"
import { Trace } from "./trace"
import { TraceFormatter } from "./trace-formatter"
import { TraceEntry } from "./trace-entry"

class TestTrace extends Trace {
    // instance data
    public traceEntry: TraceEntry | undefined

    // constructor

    constructor() {
        super(new TraceFormatter("%d [%p]: %m\n"))
    }

    // implement Trace

    /**
     * @inheritDoc
     */
    trace(entry: TraceEntry): void {
        this.traceEntry = entry
    }
}

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0))

describe("Tracer", () => {
    it("should trace", async () => { /*
        const trace = new TestTrace()
        const tracer = new Tracer({
            enabled: true,
            trace: trace,
            paths: {
                com: TraceLevel.HIGH,
                "com.foo": TraceLevel.FULL,
            },
        })

        await Tracer.Trace("not-enabled", TraceLevel.FULL, "hello world")

        expect(trace.traceEntry).toBeUndefined()

        trace.traceEntry = undefined

        await Tracer.Trace("com", TraceLevel.LOW, "hello world")

        expect(trace.traceEntry).toBeDefined()

        trace.traceEntry = undefined

        await Tracer.Trace("com", TraceLevel.FULL, "hello world")

        expect(trace.traceEntry).toBeUndefined()

        trace.traceEntry = undefined

        await Tracer.Trace("com.bar", TraceLevel.HIGH, "hello world")

        expect(trace.traceEntry).toBeDefined()

        trace.traceEntry = undefined

        await Tracer.Trace("com.foo", TraceLevel.HIGH, "hello world")

        expect(trace.traceEntry).toBeDefined()

        trace.traceEntry = undefined*/
    })
})
