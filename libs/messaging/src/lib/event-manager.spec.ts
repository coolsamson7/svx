import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Envelope } from './envelope'
import { Event, EventDescriptor } from './event.decorator'
import { EventManager } from './event-manager'
import { EventSubscription } from './subscription'
import { DeliverFn, MessageTransport } from './transport'

@Event({ name: 'em.test' })
class TestEvent {
  constructor(readonly value: string) {}
}

class PlainEnvelope extends Envelope {
  encode() {
    return this.event
  }
  decode(message: unknown) {
    return message
  }
  set() {
    /* no headers */
  }
  get() {
    return ''
  }
}

/** In-memory transport that lets the test drive the delivery path directly. */
class FakeTransport extends MessageTransport {
  started = false
  published: { descriptor: EventDescriptor; envelope: Envelope }[] = []
  deliverFns = new Map<string, DeliverFn>()

  async start() {
    this.started = true
  }
  async stop() {
    this.started = false
  }
  createSendEnvelope(event: unknown) {
    return new PlainEnvelope(event)
  }
  async send(envelope: Envelope, descriptor: EventDescriptor) {
    this.published.push({ descriptor, envelope })
  }
  async subscribe(subscription: EventSubscription, deliver: DeliverFn) {
    this.deliverFns.set(subscription.descriptor.name, deliver)
  }
}

describe('EventManager', () => {
  let transport: FakeTransport
  let manager: EventManager

  beforeEach(() => {
    transport = new FakeTransport()
    manager = new EventManager(transport)
  })

  it('routes a delivered message to the subscribed handler', async () => {
    const handler = vi.fn()
    await manager.subscribe(TestEvent, handler, 'h')

    const event = new TestEvent('hello')
    await transport.deliverFns.get('em.test')!(new PlainEnvelope(event))

    expect(handler).toHaveBeenCalledWith(event)
  })

  it('propagates a handler error through deliver (so the transport can nak)', async () => {
    await manager.subscribe(TestEvent, () => {
      throw new Error('boom')
    })

    await expect(transport.deliverFns.get('em.test')!(new PlainEnvelope(new TestEvent('x')))).rejects.toThrow('boom')
  })

  it('sends an event through the pipeline to the transport', async () => {
    await manager.send(new TestEvent('payload'))

    expect(transport.published).toHaveLength(1)
    expect(transport.published[0].descriptor.name).toBe('em.test')
    expect((transport.published[0].envelope.encode() as TestEvent).value).toBe('payload')
  })

  it('starts and stops the transport', async () => {
    await manager.start()
    expect(transport.started).toBe(true)
    await manager.stop()
    expect(transport.started).toBe(false)
  })
})
