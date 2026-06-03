import { describe, expect, it } from 'vitest'
import { Event } from './event.decorator'
import { Handle, getHandlers } from './handle.decorator'

describe('@Handle / getHandlers', () => {
  it('captures handler metadata with options', () => {
    @Event({ name: 'sample.created' })
    class SampleCreated {}

    class Listener {
      @Handle(SampleCreated, { queue: 'workers', durable: true })
      onCreated() {
        /* no-op */
      }
    }

    const handlers = getHandlers(Listener)

    expect(handlers).toHaveLength(1)
    expect(handlers[0].event).toBe(SampleCreated)
    expect(handlers[0].method).toBe('onCreated')
    expect(handlers[0].options).toEqual({ queue: 'workers', durable: true })
  })

  it('returns an empty list for a class without handlers', () => {
    class Bare {}

    expect(getHandlers(Bare)).toEqual([])
  })
})
