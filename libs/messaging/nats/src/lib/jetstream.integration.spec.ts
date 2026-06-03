import { Injectable } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { connect } from 'nats'
import { Event, EventManager, Handle, MessagingModule } from '@svx/messaging'
import { jetStreamTransport } from './jetstream.transport-factory'

// ─── Live NATS JetStream (local dev instance, started with -js) ──────────────
const NATS_URL = process.env['NATS_URL'] ?? 'nats://localhost:4222'
const STREAM = 'svx-it-jetstream'
const SUBJECTS = ['integration.js.>']

// ─── Events + listeners under test ───────────────────────────────────────────
@Event({ name: 'integration.js.order' })
class JsOrder {
  constructor(readonly id = '') {}
}

@Injectable()
class DurableListener {
  readonly received: JsOrder[] = []
  private waiters: ((event: JsOrder) => void)[] = []

  next(): Promise<JsOrder> {
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  @Handle(JsOrder, { durable: true, group: 'orders-durable', ackWait: 2000 })
  on(event: JsOrder): void {
    this.received.push(event)
    this.waiters.shift()?.(event)
  }
}

@Event({ name: 'integration.js.flaky' })
class JsFlaky {
  constructor(readonly id = '') {}
}

@Injectable()
class FlakyListener {
  attempts = 0
  succeeded?: JsFlaky
  private done?: () => void

  whenSucceeded(): Promise<void> {
    return new Promise((resolve) => (this.done = resolve))
  }

  // throws on the first delivery → nak → JetStream redelivers → succeeds on retry
  @Handle(JsFlaky, { durable: true, group: 'flaky-durable', ackWait: 1000 })
  on(event: JsFlaky): void {
    this.attempts++
    if (this.attempts < 2) throw new Error('transient failure')
    this.succeeded = event
    this.done?.()
  }
}

/** Remove the test stream (and its consumers/messages) for run-to-run isolation. */
async function deleteStream(): Promise<void> {
  const nc = await connect({ servers: NATS_URL, name: 'svx-jetstream-it-cleanup' })
  try {
    const jsm = await nc.jetstreamManager()
    await jsm.streams.delete(STREAM)
  } catch {
    // stream may not exist yet — ignore
  } finally {
    await nc.drain()
  }
}

// ─── Test suite ───────────────────────────────────────────────────────────────
// Full NestJS context wired to the JetStream transport. Asserts durable delivery
// and the at-least-once contract: a throwing handler is nak'd and redelivered.
// Requires a running NATS broker with JetStream enabled at NATS_URL.
describe('JetStream integration (NATS)', () => {
  let app: TestingModule
  let manager: EventManager
  let durable: DurableListener
  let flaky: FlakyListener

  beforeAll(async () => {
    await deleteStream()

    app = await Test.createTestingModule({
      imports: [
        MessagingModule.forRoot({
          transport: jetStreamTransport({
            servers: NATS_URL,
            name: 'svx-jetstream-it',
            stream: { name: STREAM, subjects: SUBJECTS },
          }),
        }),
      ],
      providers: [DurableListener, FlakyListener],
    }).compile()

    await app.init()

    manager = app.get(EventManager)
    durable = app.get(DurableListener)
    flaky = app.get(FlakyListener)
  })

  afterAll(async () => {
    await app?.close()
    await deleteStream()
  })

  it('delivers a persisted event to a durable consumer', async () => {
    const arrived = durable.next()

    await manager.send(new JsOrder('order-1'))

    const event = await arrived
    expect(event).toBeInstanceOf(JsOrder)
    expect(event.id).toBe('order-1')
  })

  it('redelivers a nak\'d event until the handler succeeds (at-least-once)', async () => {
    const done = flaky.whenSucceeded()

    await manager.send(new JsFlaky('flaky-1'))

    await done
    expect(flaky.attempts).toBeGreaterThanOrEqual(2)
    expect(flaky.succeeded?.id).toBe('flaky-1')
  })
})
