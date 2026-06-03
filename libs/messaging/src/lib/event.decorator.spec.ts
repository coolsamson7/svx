import { describe, expect, it } from 'vitest'
import { Event, EventRegistry } from './event.decorator'

describe('@Event / EventRegistry', () => {
  it('registers a descriptor with an explicit name', () => {
    @Event({ name: 'order.created', durable: true })
    class OrderCreated {}

    const descriptor = EventRegistry.forType(OrderCreated)

    expect(descriptor.name).toBe('order.created')
    expect(descriptor.durable).toBe(true)
    expect(descriptor.broadcast).toBe(false)
    expect(EventRegistry.forName('order.created')).toBe(descriptor)
  })

  it('defaults the name to the class name', () => {
    @Event()
    class PlainEvent {}

    expect(EventRegistry.forType(PlainEvent).name).toBe('PlainEvent')
  })

  it('throws for an unregistered type', () => {
    class NotAnEvent {}

    expect(() => EventRegistry.forType(NotAnEvent)).toThrow(/not an @Event/)
  })
})
