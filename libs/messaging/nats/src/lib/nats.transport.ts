import { Logger } from '@nestjs/common'
import { connect, ConnectionOptions, NatsConnection, Subscription } from 'nats'
import {
  Codec,
  DeliverFn,
  Envelope,
  EventDescriptor,
  EventSubscription,
  JsonCodec,
  MessageTransport,
} from '@svx/messaging'
import { NatsEnvelope, NatsEnvelopeFactory } from './nats-envelope'

/**
 * Options for {@link NatsCoreTransport}.
 */
export interface NatsTransportOptions {
  /** NATS server URL(s), e.g. <code>'nats://localhost:4222'</code>. */
  servers: string | string[]
  /** connection name reported to the server. */
  name?: string
  /** codec for event (de)serialization; defaults to JSON. */
  codec?: Codec
  /** extra raw nats connection options merged in. */
  connection?: Partial<ConnectionOptions>
}

/**
 * Core-NATS {@link MessageTransport}: subject = event name, optional queue group for
 * load-balancing. Core NATS is at-most-once, so ack/nak are no-ops here — a failing handler is
 * logged but not redelivered. A JetStream transport implements the same seam with real ack/nak.
 */
export class NatsCoreTransport extends MessageTransport {
  // instance data

  private readonly logger = new Logger(NatsCoreTransport.name)
  private readonly factory: NatsEnvelopeFactory
  private readonly subscriptions: Subscription[] = []
  private connection?: NatsConnection

  // constructor

  constructor(private readonly options: NatsTransportOptions) {
    super()

    this.factory = new NatsEnvelopeFactory(options.codec ?? new JsonCodec())
  }

  // lifecycle

  async start(): Promise<void> {
    this.connection = await connect({
      ...this.options.connection,
      servers: this.options.servers,
      name: this.options.name,
    })

    this.logger.log(`Connected to NATS at ${this.connection.getServer()}`)
  }

  async stop(): Promise<void> {
    for (const subscription of this.subscriptions) subscription.unsubscribe()

    this.subscriptions.length = 0

    await this.connection?.drain()
    this.connection = undefined
  }

  // implement MessageTransport

  createSendEnvelope(event: unknown, descriptor: EventDescriptor): Envelope {
    return this.factory.forSend(event, descriptor)
  }

  async send(envelope: Envelope, descriptor: EventDescriptor): Promise<void> {
    const connection = this.requireConnection()
    const natsEnvelope = envelope as NatsEnvelope

    connection.publish(descriptor.name, natsEnvelope.encode(), { headers: natsEnvelope.toHeaders() })
  }

  async subscribe(subscription: EventSubscription, deliver: DeliverFn): Promise<void> {
    const connection = this.requireConnection()
    const queue = subscription.options.queue ?? subscription.options.group

    const sub = connection.subscribe(subscription.descriptor.name, queue ? { queue } : {})
    this.subscriptions.push(sub)

    // consume the subscription's async iterator without blocking start-up
    void this.consume(sub, subscription, deliver)
  }

  // internal

  private requireConnection(): NatsConnection {
    if (!this.connection) throw new Error('NATS transport not started')

    return this.connection
  }

  private async consume(sub: Subscription, subscription: EventSubscription, deliver: DeliverFn): Promise<void> {
    for await (const msg of sub) {
      try {
        // decode (and, with a validating codec, validate) inside the try so failures are handled
        const envelope = this.factory.forReceive(msg, subscription.descriptor)
        await deliver(envelope)
        // core NATS: at-most-once — nothing to ack
      } catch (error) {
        // core NATS has no redelivery; log. A JetStream transport would nak/term here.
        const err = error as Error
        this.logger.error(
          `Handler '${subscription.name}' failed for '${subscription.descriptor.name}': ${err.message}`,
          err.stack,
        )
      }
    }
  }
}
