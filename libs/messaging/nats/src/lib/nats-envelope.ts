import { headers as natsHeaders, MsgHdrs } from 'nats'
import {
  AbstractEnvelope,
  Codec,
  EnvelopeFactory,
  EventDescriptor,
  JsonCodec,
} from '@svx/messaging'

/**
 * The shape of an incoming NATS message used on the receive path — both core {@link Msg} and
 * JetStream {@link JsMsg} satisfy it.
 */
export interface IncomingMessage {
  data: Uint8Array
  headers?: MsgHdrs
}

/**
 * NATS {@link AbstractEnvelope}: encodes/decodes the event to <code>Uint8Array</code> via a
 * {@link Codec} and maps headers to/from NATS {@link MsgHdrs}.
 */
export class NatsEnvelope extends AbstractEnvelope<Uint8Array> {
  constructor(
    private readonly codec: Codec,
    private readonly descriptor: EventDescriptor,
    event?: unknown,
    message?: IncomingMessage,
  ) {
    super(event)

    if (message !== undefined) {
      this.readHeaders(message.headers)
      this.event = this.decode(message.data)
    }
  }

  // implement Envelope

  encode(): Uint8Array {
    return this.codec.encode(this.event)
  }

  decode(message: Uint8Array): unknown {
    return this.codec.decode(message, this.descriptor.type)
  }

  // nats specifics

  toHeaders(): MsgHdrs {
    const hdrs = natsHeaders()

    for (const [key, value] of Object.entries(this.headers)) hdrs.set(key, value)

    return hdrs
  }

  private readHeaders(hdrs?: MsgHdrs): void {
    if (!hdrs) return

    for (const key of hdrs.keys()) this.headers[key] = hdrs.get(key)
  }
}

/**
 * Builds {@link NatsEnvelope}s for the send and receive paths.
 */
export class NatsEnvelopeFactory implements EnvelopeFactory {
  constructor(private readonly codec: Codec = new JsonCodec()) {}

  forSend(event: unknown, descriptor: EventDescriptor): NatsEnvelope {
    return new NatsEnvelope(this.codec, descriptor, event)
  }

  forReceive(message: unknown, descriptor: EventDescriptor): NatsEnvelope {
    return new NatsEnvelope(this.codec, descriptor, undefined, message as IncomingMessage)
  }
}
