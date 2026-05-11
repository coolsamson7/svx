import { TraceLevel } from "./trace-level"
import { Trace } from "./trace"

/**
 * the configuration object for the tracer module
 */
export interface TracerConfiguration {
    /**
     * if <code>true</code> tracing is active
     */
    enabled: boolean
    /**
     * the configured {@link Trace}
     */
    trace: Trace
    /**
     * the paths.
     */
    paths: { [path: string]: TraceLevel }
}
