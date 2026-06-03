import { Provider } from '@nestjs/common'
import { MessageTransport } from '@svx/messaging'
import { NatsCoreTransport, NatsTransportOptions } from './nats.transport'

/**
 * Builds a NestJS provider that binds the {@link MessageTransport} token to a
 * {@link NatsCoreTransport}. Pass the result to <code>MessagingModule.forRoot({ transport })</code>.
 */
export function natsTransport(options: NatsTransportOptions): Provider {
  return {
    provide: MessageTransport,
    useFactory: () => new NatsCoreTransport(options),
  }
}
