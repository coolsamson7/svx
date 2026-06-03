import { Envelope } from './envelope'
import { EventDescriptor } from './event.decorator'
import { EventSubscription } from './subscription'

/**
 * Delivers one received {@link Envelope} (decoded event + headers) into the receive pipeline and,
 * ultimately, the handler. Resolving acknowledges the message; rejecting signals failure so the
 * transport can negatively-acknowledge / redeliver (at-least-once contract).
 */
export type DeliverFn = (envelope: Envelope) => Promise<void>

/**
 * The bridge to a low-level messaging library and the single seam across which transports are
 * swapped (core NATS, JetStream, ...). The {@link EventManager} owns the pipeline chains and talks
 * only to this abstraction: {@link send} is the send-path terminus (publish), {@link subscribe}
 * feeds received envelopes back through {@link DeliverFn}.
 */
export abstract class MessageTransport {
  abstract start(): Promise<void>

  abstract stop(): Promise<void>

  /** build the outgoing {@link Envelope} for an event (transport owns encoding/headers). */
  abstract createSendEnvelope(event: unknown, descriptor: EventDescriptor): Envelope

  /** send-path terminus: publish the (pipeline-processed) envelope. */
  abstract send(envelope: Envelope, descriptor: EventDescriptor): Promise<void>

  /** set up the underlying subscription and invoke <code>deliver</code> per received message. */
  abstract subscribe(subscription: EventSubscription, deliver: DeliverFn): Promise<void>
}
