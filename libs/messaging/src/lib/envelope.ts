import { EventDescriptor } from './event.decorator'

/**
 * Wrapper around an event while it is being sent or received. The generic <code>T</code> is the
 * transport wire type (e.g. <code>Uint8Array</code> for NATS). Carries the decoded event plus
 * string headers.
 */
export abstract class Envelope<T = unknown> {
  /** the decoded event payload. */
  event: unknown

  constructor(event?: unknown) {
    this.event = event
  }

  // encoding

  abstract encode(): T

  abstract decode(message: T): unknown

  // headers

  abstract set(key: string, value: string): void

  abstract get(key: string): string
}

/**
 * Base {@link Envelope} that stores headers in a plain string map.
 */
export abstract class AbstractEnvelope<T = unknown> extends Envelope<T> {
  protected readonly headers: Record<string, string> = {}

  set(key: string, value: string): void {
    this.headers[key] = value
  }

  get(key: string): string {
    return this.headers[key] ?? ''
  }
}

/**
 * Creates transport-specific envelopes for the send and receive paths.
 */
export interface EnvelopeFactory {
  forSend(event: unknown, descriptor: EventDescriptor): Envelope

  forReceive(message: unknown, descriptor: EventDescriptor): Envelope
}
