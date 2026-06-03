import { Logger } from '@nestjs/common'
import {
  AckPolicy,
  connect,
  ConnectionOptions,
  ConsumerMessages,
  JetStreamClient,
  JetStreamManager,
  nanos,
  NatsConnection,
  RetentionPolicy,
  StorageType,
} from 'nats'
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
 * Stream configuration. The stream must cover every subject (event name) that is published or
 * subscribed. <code>subjects</code> defaults to <code>['&gt;']</code> (all subjects) for dev.
 */
export interface JetStreamStreamOptions {
  name?: string
  subjects?: string[]
  storage?: StorageType
  retention?: RetentionPolicy
}

/**
 * Options for {@link JetStreamTransport}.
 */
export interface JetStreamTransportOptions {
  servers: string | string[]
  name?: string
  codec?: Codec
  connection?: Partial<ConnectionOptions>
  stream?: JetStreamStreamOptions
}

const DEFAULT_STREAM = 'svx-messaging'

/**
 * JetStream {@link MessageTransport}: persistent streams + durable consumers with real
 * at-least-once delivery. A handler that resolves <code>ack()</code>s the message; a handler that
 * throws <code>nak()</code>s it for redelivery. The {@link Handle} <code>durable</code> /
 * <code>ackWait</code> options (ignored by core NATS) take effect here.
 *
 * Same connection and {@link NatsEnvelope} as {@link NatsCoreTransport} — only the delivery
 * guarantees differ. The {@link MessageTransport} seam means handlers are unchanged when swapping.
 */
export class JetStreamTransport extends MessageTransport {
  // instance data

  private readonly logger = new Logger(JetStreamTransport.name)
  private readonly factory: NatsEnvelopeFactory
  private readonly streamName: string
  private readonly consumers: ConsumerMessages[] = []
  private connection?: NatsConnection
  private js?: JetStreamClient
  private jsm?: JetStreamManager

  // constructor

  constructor(private readonly options: JetStreamTransportOptions) {
    super()

    this.factory = new NatsEnvelopeFactory(options.codec ?? new JsonCodec())
    this.streamName = options.stream?.name ?? DEFAULT_STREAM
  }

  // lifecycle

  async start(): Promise<void> {
    this.connection = await connect({
      ...this.options.connection,
      servers: this.options.servers,
      name: this.options.name,
    })

    this.js = this.connection.jetstream()
    this.jsm = await this.connection.jetstreamManager()

    await this.ensureStream()

    this.logger.log(`Connected to NATS JetStream at ${this.connection.getServer()} (stream '${this.streamName}')`)
  }

  async stop(): Promise<void> {
    for (const messages of this.consumers) messages.stop()

    this.consumers.length = 0

    await this.connection?.drain()
    this.connection = undefined
    this.js = undefined
    this.jsm = undefined
  }

  // implement MessageTransport

  createSendEnvelope(event: unknown, descriptor: EventDescriptor): Envelope {
    return this.factory.forSend(event, descriptor)
  }

  async send(envelope: Envelope, descriptor: EventDescriptor): Promise<void> {
    if (!this.js) throw new Error('JetStream transport not started')

    const natsEnvelope = envelope as NatsEnvelope

    // js.publish resolves with a PubAck once the message is persisted to the stream
    await this.js.publish(descriptor.name, natsEnvelope.encode(), { headers: natsEnvelope.toHeaders() })
  }

  async subscribe(subscription: EventSubscription, deliver: DeliverFn): Promise<void> {
    if (!this.js || !this.jsm) throw new Error('JetStream transport not started')

    const subject = subscription.descriptor.name
    const options = subscription.options

    // a truthy `durable` flag yields a named durable consumer (survives restarts); otherwise ephemeral
    const durableName = options.durable ? (options.group ?? options.queue ?? subscription.name) : undefined

    const info = await this.jsm.consumers.add(this.streamName, {
      durable_name: durableName,
      ack_policy: AckPolicy.Explicit,
      ack_wait: options.ackWait ? nanos(options.ackWait) : undefined,
      filter_subject: subject,
    })

    const consumer = await this.js.consumers.get(this.streamName, info.name)
    const messages = await consumer.consume()
    this.consumers.push(messages)

    void this.consume(messages, subscription, deliver)
  }

  // internal

  private async ensureStream(): Promise<void> {
    if (!this.jsm) throw new Error('JetStream transport not started')

    const config = {
      name: this.streamName,
      subjects: this.options.stream?.subjects ?? ['>'],
      retention: this.options.stream?.retention ?? RetentionPolicy.Limits,
      storage: this.options.stream?.storage ?? StorageType.File,
    }

    try {
      await this.jsm.streams.add(config)
    } catch (error) {
      // stream already exists — ensure it covers the configured subjects, otherwise surface
      const err = error as Error
      if (/already in use|already exists/i.test(err.message)) {
        await this.jsm.streams.update(this.streamName, config)
      } else {
        throw err
      }
    }
  }

  private async consume(messages: ConsumerMessages, subscription: EventSubscription, deliver: DeliverFn): Promise<void> {
    for await (const msg of messages) {
      try {
        // decode (and, with a validating codec, validate) inside the try so failures are nak'd
        const envelope = this.factory.forReceive(msg, subscription.descriptor)
        await deliver(envelope)
        msg.ack()
      } catch (error) {
        // at-least-once: negatively acknowledge so JetStream redelivers (subject to ack_wait/max_deliver)
        const err = error as Error
        this.logger.error(
          `Handler '${subscription.name}' failed for '${subscription.descriptor.name}', nak: ${err.message}`,
          err.stack,
        )
        msg.nak()
      }
    }
  }
}
