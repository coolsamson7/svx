import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Event, EventRegistry, EventSubscription } from '@svx/messaging'

// ─── nats mock ──────────────────────────────────────────────────────────────

/** Minimal async-iterable queue to emulate a NATS Subscription. */
class FakeSubscription {
  unsubscribe = vi.fn()
  private items: unknown[] = []
  private resolvers: ((r: IteratorResult<unknown>) => void)[] = []
  private ended = false

  emit(item: unknown): void {
    const resolve = this.resolvers.shift()
    if (resolve) resolve({ value: item, done: false })
    else this.items.push(item)
  }

  end(): void {
    this.ended = true
    for (const resolve of this.resolvers.splice(0)) resolve({ value: undefined, done: true })
  }

  [Symbol.asyncIterator](): AsyncIterator<unknown> {
    return {
      next: () => {
        if (this.items.length) return Promise.resolve({ value: this.items.shift(), done: false })
        if (this.ended) return Promise.resolve({ value: undefined, done: true })
        return new Promise((resolve) => this.resolvers.push(resolve))
      },
    }
  }
}

const fakeSub = new FakeSubscription()
const publish = vi.fn()
const subscribe = vi.fn(() => fakeSub)
const drain = vi.fn(async () => undefined)

vi.mock('nats', () => ({
  connect: vi.fn(async () => ({
    getServer: () => 'nats://test:4222',
    publish,
    subscribe,
    drain,
  })),
  headers: () => {
    const map = new Map<string, string>()
    return { set: (k: string, v: string) => map.set(k, v) }
  },
}))

// imported after the mock is declared
import { NatsCoreTransport } from './nats.transport'
import { NatsEnvelopeFactory } from './nats-envelope'

@Event({ name: 'nats.test' })
class NatsTestEvent {
  constructor(readonly value: string) {}
}

describe('NatsCoreTransport', () => {
  let transport: NatsCoreTransport

  beforeEach(async () => {
    publish.mockClear()
    subscribe.mockClear()
    transport = new NatsCoreTransport({ servers: 'nats://test:4222' })
    await transport.start()
  })

  it('round-trips an event through the envelope factory', () => {
    const factory = new NatsEnvelopeFactory()
    const descriptor = EventRegistry.forType(NatsTestEvent)

    const bytes = factory.forSend(new NatsTestEvent('hi'), descriptor).encode()
    const decoded = factory.forReceive({ data: bytes }, descriptor).event as NatsTestEvent

    expect(decoded).toBeInstanceOf(NatsTestEvent)
    expect(decoded.value).toBe('hi')
  })

  it('publishes to the event subject', async () => {
    const descriptor = EventRegistry.forType(NatsTestEvent)
    const envelope = transport.createSendEnvelope(new NatsTestEvent('out'), descriptor)

    await transport.send(envelope, descriptor)

    expect(publish).toHaveBeenCalledTimes(1)
    expect(publish.mock.calls[0][0]).toBe('nats.test')
  })

  it('subscribes with a queue group and delivers decoded events', async () => {
    const descriptor = EventRegistry.forType(NatsTestEvent)
    const deliver = vi.fn(async () => undefined)
    const subscription = new EventSubscription('1', descriptor, () => undefined, 'h', { queue: 'workers' })

    await transport.subscribe(subscription, deliver)

    expect(subscribe).toHaveBeenCalledWith('nats.test', { queue: 'workers' })

    const bytes = new NatsEnvelopeFactory().forSend(new NatsTestEvent('msg'), descriptor).encode()
    fakeSub.emit({ data: bytes })

    // allow the consume loop to process the queued message; deliver now receives the envelope
    await vi.waitFor(() => expect(deliver).toHaveBeenCalledTimes(1))
    const envelope = deliver.mock.calls[0][0] as { event: NatsTestEvent }
    expect((envelope.event as NatsTestEvent).value).toBe('msg')

    fakeSub.end()
  })
})
