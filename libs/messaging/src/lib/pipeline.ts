import { Envelope } from './envelope'
import { EventDescriptor } from './event.decorator'

/**
 * Continuation passed to a pipeline step. Call it to proceed to the next pipeline (or the
 * terminus: publishing on the send path, invoking the handler on the receive path). Not calling it
 * short-circuits the chain.
 */
export type PipelineNext = () => Promise<void>

/**
 * A symmetric interceptor around the messaging flow. <code>send</code> runs on the way out (e.g.
 * stamp the current session into headers); <code>receive</code> runs on the way in, in reverse
 * order (e.g. read the session header back and re-establish it before the handler runs). Implement
 * either or both.
 */
export interface EnvelopePipeline {
  send?(envelope: Envelope, descriptor: EventDescriptor, next: PipelineNext): Promise<void>

  receive?(envelope: Envelope, descriptor: EventDescriptor, next: PipelineNext): Promise<void>
}

/** Constructor of an {@link EnvelopePipeline}. */
export type EnvelopePipelineClass = new (...args: any[]) => EnvelopePipeline

// process-wide registry filled by the @EnvelopePipeline decorator at class-definition time
const registry: { cls: EnvelopePipelineClass; order: number }[] = []

/**
 * Marks a class as an {@link EnvelopePipeline} and registers it. <code>MessagingModule.forRoot()</code>
 * reads {@link registeredPipelines} to add these classes to its own providers and chain them — no
 * runtime discovery required.
 *
 * @param order chain position, ascending. Lower runs first on the send path (outermost) and last
 *   on the receive path. Defaults to <code>0</code>; ties keep decoration order.
 */
export function EnvelopePipeline(order = 0): ClassDecorator {
  return (target) => {
    const cls = target as unknown as EnvelopePipelineClass
    if (!registry.some((entry) => entry.cls === cls)) registry.push({ cls, order })
  }
}

/**
 * The registered {@link EnvelopePipeline} classes, sorted by ascending <code>order</code>.
 */
export function registeredPipelines(): EnvelopePipelineClass[] {
  return [...registry].sort((a, b) => a.order - b.order).map((entry) => entry.cls)
}
