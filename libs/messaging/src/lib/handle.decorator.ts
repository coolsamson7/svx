import { EventType } from './event.decorator'

/**
 * Options for the {@link Handle} decorator. These carry transport hints. Core NATS uses only
 * <code>queue</code>/<code>group</code>; JetStream additionally honours <code>durable</code>/
 * <code>ackWait</code>. Keeping them here means the handler API does not change when the transport
 * is swapped.
 */
export interface HandleOptions {
  /** explicit subscription name; defaults to <code>Class.method</code>. */
  name?: string
  /** logical consumer group (alias for <code>queue</code>). */
  group?: string
  /** NATS queue group — members load-balance the subject. */
  queue?: string
  /** durable consumer name (JetStream). */
  durable?: boolean
  /** ack timeout in ms before redelivery (JetStream). */
  ackWait?: number
}

/**
 * One registered handler: the declaring class, the event it handles, the method name and options.
 * The owner class is resolved from DI at bootstrap, so no runtime discovery is needed.
 */
export interface HandleRegistration {
  owner: Function
  event: EventType
  method: string
  options: HandleOptions
}

// process-wide registry filled by the @Handle decorator at class-definition time
const registry: HandleRegistration[] = []

/**
 * Marks a method of an injectable as the handler for <code>event</code>. The method receives the
 * decoded event instance. Resolving normally acknowledges the message; throwing signals failure
 * (negative ack / redelivery on transports that support it).
 *
 * The declaring class is registered statically; <code>MessagingModule</code> resolves its instance
 * from DI at bootstrap and wires the subscription.
 *
 * @param event the event type to handle
 * @param options transport hints (queue group, durability, ...)
 */
export function Handle(event: EventType, options: HandleOptions = {}): MethodDecorator {
  return (target, propertyKey) => {
    registry.push({ owner: (target as object).constructor, event, method: propertyKey as string, options })
  }
}

/**
 * All registered handlers, in decoration order.
 */
export function registeredHandlers(): HandleRegistration[] {
  return [...registry]
}

/**
 * The handlers declared on a specific class.
 */
export function getHandlers(owner: Function): HandleRegistration[] {
  return registry.filter((registration) => registration.owner === owner)
}
