import { Provider } from '@nestjs/common'
import { MessageTransport } from '@svx/messaging'
import { JetStreamTransport, JetStreamTransportOptions } from './jetstream.transport'

/**
 * Builds a NestJS provider that binds the {@link MessageTransport} token to a
 * {@link JetStreamTransport} (persistent, at-least-once). Drop-in alternative to
 * <code>natsTransport()</code>; pass the result to <code>MessagingModule.forRoot({ transport })</code>.
 */
export function jetStreamTransport(options: JetStreamTransportOptions): Provider {
  return {
    provide: MessageTransport,
    useFactory: () => new JetStreamTransport(options),
  }
}
