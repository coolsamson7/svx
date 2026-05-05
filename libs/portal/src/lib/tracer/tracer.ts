import { TraceLevel } from "./trace-level"
import type { TracerConfiguration } from "./tracer-configuration"
import { Trace } from "./trace"
import { TraceEntry } from "./trace-entry"
import { ConsoleTrace } from "./trace/console-trace"
import { StackFrame, Stacktrace } from "../util"

const IGNORED_FRAME_PATTERNS = [
  /reflect.?metadata/i,
  /Reflect\./,
  /__decorate/,
  /node_modules/,
];

function findCallerFrame(frames: StackFrame[]): StackFrame | null {
  // Skip frame[0] (Tracer.Trace itself), then find first non-noise frame
  return frames.slice(1).find(f => 
    f.file && !IGNORED_FRAME_PATTERNS.some(p => p.test(f.file!))
  ) ?? null;
}

/**
 * A Tracer is used to emit trace messages for development purposes.
 * While it shares the logic of a typical logger, it will be turned of in production.
 */
export class Tracer {
    // static

    public static ENABLED = true

    private static This: Tracer

    static getSingleton() {
        if (!Tracer.This)
            new Tracer({
                enabled: true,
                trace: new ConsoleTrace("%d [%p]: %m\n"),
                paths: {
                    "": TraceLevel.FULL,
                },
            })

        return Tracer.This
    }

    public static async Trace(path: string, level: TraceLevel, message: string, ...args: any[]) {
        const instance = Tracer.getSingleton()

        if ( instance.getTraceLevel(path) >= level) {
            const stack = new Error().stack!

            const frames = Stacktrace.createFrames(stack)

            const lastFrame =  findCallerFrame(frames)! // frames[1]

            await instance.trace(path, level, message, lastFrame, ...args).catch(console.error)
        }
    }

    // instance data

    private traceLevels: { [path: string]: TraceLevel } = {}
    private cachedTraceLevels: { [path: string]: TraceLevel } = {}
    private modifications = 0
    private sink: Trace | undefined

    constructor(tracerConfiguration: TracerConfiguration) {
        if (tracerConfiguration) {
            // enabled

            Tracer.ENABLED = tracerConfiguration.enabled

            // some more

            this.sink = tracerConfiguration.trace

            // set paths

            for (const path of Object.keys(tracerConfiguration.paths)) {
                this.setTraceLevel(path, tracerConfiguration.paths[path])
            }
        }

        Tracer.This = this
    }

    // public

    public isTraced(path: string, level: TraceLevel): boolean {
        return this.getTraceLevel(path) >= level
    }

    public async trace(path: string, level: TraceLevel, message: string, frame: StackFrame, ...args: any[]) {
        if (Tracer.ENABLED && this.getTraceLevel(path) >= level) {
             // new

            await Stacktrace.mapFrames(frame)

            // format

            const formattedMessage = message.replace(/{(\d+)}/g, function (match, number) {
                let value = args[+number]

                if (value === undefined) value = "undefined"
                else if (value === null) value = "null"

                return value
            })

            // and write

            this.sink?.trace(new TraceEntry(path, level, formattedMessage, new Date(), frame))
        }
    }

    // private

    private getTraceLevel(path: string): TraceLevel {
        // check dirty state

        if (this.modifications > 0) {
            this.cachedTraceLevels = {} // restart from scratch
            this.modifications = 0
        } // if

        let level = this.cachedTraceLevels[path]
        if (!level) {
            level = this.traceLevels[path]
            if (!level) {
                const index = path.lastIndexOf(".")
                level = index != -1 ? this.getTraceLevel(path.substring(0, index)) : TraceLevel.OFF
            } // if

            // cache

            this.cachedTraceLevels[path] = level
        } // if

        return level
    }

    private setTraceLevel(path: string, level: TraceLevel): void {
        this.traceLevels[path] = level
        this.modifications++
    }
}
