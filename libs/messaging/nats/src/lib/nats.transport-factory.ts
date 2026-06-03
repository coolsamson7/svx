import { Provider } from '@nestjs/common'
import { JsonCodec, MessageTransport, VALIDATE_EVENTS, ValidatingCodec } from '@svx/messaging'
import { NatsCoreTransport, NatsTransportOptions } from './nats.transport'

/**
 * Builds a NestJS provider that binds the {@link MessageTransport} token to a
 * {@link NatsCoreTransport}. Pass the result to <code>MessagingModule.forRoot({ transport })</code>.
 *
 * The codec is chosen as: an explicit <code>options.codec</code> wins; otherwise the module-level
 * <code>validate</code> flag (injected via {@link VALIDATE_EVENTS}) selects {@link ValidatingCodec}
 * or plain {@link JsonCodec}.
 */
export function natsTransport(options: NatsTransportOptions): Provider {
  return {
    provide: MessageTransport,
    useFactory: (validate?: boolean) =>
      new NatsCoreTransport({
        ...options,
        codec: options.codec ?? (validate ? new ValidatingCodec() : new JsonCodec()),
      }),
    inject: [{ token: VALIDATE_EVENTS, optional: true }],
  }
}
