import 'reflect-metadata'

/**
 * Any event class. Abstract constructor signature so both concrete and abstract event
 * types are accepted.
 */
export type EventType<T = unknown> = abstract new (...args: any[]) => T

/**
 * Options for the {@link Event} decorator.
 */
export interface EventOptions {
  /** logical event name; defaults to the class name. Used as the transport subject/topic. */
  name?: string
  /** if <code>true</code>, the event is delivered to every subscriber (fan-out) rather than load-balanced. */
  broadcast?: boolean
  /** if <code>true</code>, the underlying queue/stream should be persistent. */
  durable?: boolean
}

/**
 * Captures the metadata of an event class.
 */
export class EventDescriptor {
  constructor(
    readonly type: EventType,
    readonly name: string,
    readonly broadcast: boolean,
    readonly durable: boolean,
  ) {}
}

/**
 * Process-wide registry of all {@link Event}-decorated classes, indexed by type and by name.
 */
export class EventRegistry {
  // static data

  private static readonly byType = new Map<EventType, EventDescriptor>()
  private static readonly byName = new Map<string, EventDescriptor>()

  // static methods

  static register(descriptor: EventDescriptor): void {
    EventRegistry.byType.set(descriptor.type, descriptor)
    EventRegistry.byName.set(descriptor.name, descriptor)
  }

  static forType(type: EventType): EventDescriptor {
    const descriptor = EventRegistry.byType.get(type)
    if (!descriptor) throw new Error(`${(type as { name?: string }).name ?? type} is not an @Event`)

    return descriptor
  }

  static forName(name: string): EventDescriptor {
    const descriptor = EventRegistry.byName.get(name)
    if (!descriptor) throw new Error(`No event registered with name '${name}'`)

    return descriptor
  }
}

/**
 * Decorates an event class and registers its {@link EventDescriptor}.
 *
 * @param options event options; <code>name</code> defaults to the class name.
 */
export function Event(options: EventOptions = {}): ClassDecorator {
  return (target) => {
    const type = target as unknown as EventType
    const name = options.name && options.name.length > 0 ? options.name : (target as { name: string }).name

    EventRegistry.register(new EventDescriptor(type, name, options.broadcast ?? false, options.durable ?? false))
  }
}
