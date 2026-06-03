import { EventDescriptor } from './event.decorator'
import { HandleOptions } from './handle.decorator'

/**
 * Invoked with the decoded event. Resolving acknowledges the message; throwing signals failure.
 */
export type EventCallback = (event: unknown) => unknown | Promise<unknown>

/**
 * Descriptor for a single active subscription — the binding of one handler to one event.
 */
export class EventSubscription {
  constructor(
    readonly id: string,
    readonly descriptor: EventDescriptor,
    readonly callback: EventCallback,
    readonly name: string,
    readonly options: HandleOptions = {},
  ) {}
}
