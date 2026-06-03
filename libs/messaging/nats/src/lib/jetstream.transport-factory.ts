import { Provider } from '@nestjs/common'
import { JsonCodec, MessageTransport, VALIDATE_EVENTS, ValidatingCodec } from '@svx/messaging'
import { JetStreamTransport, JetStreamTransportOptions } from './jetstream.transport'

/**
 * Builds a NestJS provider that binds the {@link MessageTransport} token to a
 * {@link JetStreamTransport} (persistent, at-least-once). Drop-in alternative to
 * <code>natsTransport()</code>; pass the result to <code>MessagingModule.forRoot({ transport })</code>.
 *
 * The codec is chosen as: an explicit <code>options.codec</code> wins; otherwise the module-level
 * <code>validate</code> flag (injected via {@link VALIDATE_EVENTS}) selects {@link ValidatingCodec}
 * or plain {@link JsonCodec}.
 */
export function jetStreamTransport(options: JetStreamTransportOptions): Provider {
  return {
    provide: MessageTransport,
    useFactory: (validate?: boolean) =>
      new JetStreamTransport({
        ...options,
        codec: options.codec ?? (validate ? new ValidatingCodec() : new JsonCodec()),
      }),
    inject: [{ token: VALIDATE_EVENTS, optional: true }],
  }
}
