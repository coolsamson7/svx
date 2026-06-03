import { AsyncLocalStorage } from 'node:async_hooks'
import { Injectable } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { connect } from 'nats'
import { Implements, type InferObject, number, object, string } from '@svx/common'
import {
  Envelope,
  EnvelopePipeline,
  Event,
  EventDescriptor,
  EventManager,
  Handle,
  MessagingModule,
  PipelineNext,
} from '@svx/messaging'
import { Provider } from '@nestjs/common'
import { natsTransport } from './nats.transport-factory'
import { jetStreamTransport } from './jetstream.transport-factory'

// ─── Live NATS (local dev instance, see docker/docker-compose.yml) ───────────
const NATS_URL = process.env['NATS_URL'] ?? 'nats://localhost:4222'

// The same suite runs against both transports so we see each behave identically through the seam.
interface TransportCase {
  name: string
  useStream: boolean
  provider: () => Provider
}

const TRANSPORTS: TransportCase[] = [
  {
    name: 'core NATS',
    useStream: false,
    provider: () => natsTransport({ servers: NATS_URL, name: 'svx-messaging-it' }),
  },
  {
    name: 'JetStream',
    useStream: true,
    provider: () =>
      jetStreamTransport({
        servers: NATS_URL,
        name: 'svx-messaging-it',
        stream: { name: STREAM, subjects: SUBJECTS },
      }),
  },
]

// JetStream stream covering the events in this spec (persisted, so we clean it per run)
const STREAM = 'svx-it-messaging'
const SUBJECTS = ['integration.>']

/** Remove the test stream for run-to-run isolation (avoids stale persisted messages). */
async function deleteStream(): Promise<void> {
  const nc = await connect({ servers: NATS_URL, name: 'svx-messaging-it-cleanup' })
  try {
    const jsm = await nc.jetstreamManager()
    await jsm.streams.delete(STREAM)
  } catch {
    // stream may not exist yet — ignore
  } finally {
    await nc.drain()
  }
}

// ─── Mock user session + symmetric session pipeline ──────────────────────────
interface MockSession {
  userId: string
  name: string
}

// stands in for the request/session context (cf. tokenStorage in the user-inventory spec)
const sessionStore = new AsyncLocalStorage<MockSession>()

/**
 * Symmetric interceptor. <code>send</code> captures the current session and stamps it into the
 * envelope header so it travels with the event. <code>receive</code> reads the header back and
 * re-establishes the session ("replay") so the handler runs inside the original session context —
 * exactly mirroring the send side.
 */
@Injectable()
@EnvelopePipeline()
class SessionPipeline implements EnvelopePipeline {
  readonly captured: { subject: string; session: string }[] = []
  readonly replayed: MockSession[] = []

  async send(envelope: Envelope, descriptor: EventDescriptor, next: PipelineNext): Promise<void> {
    const session = sessionStore.getStore()

    if (session) {
      const header = JSON.stringify(session)
      envelope.set('x-session', header)
      this.captured.push({ subject: descriptor.name, session: header })
    }

    await next()
  }

  async receive(envelope: Envelope, _descriptor: EventDescriptor, next: PipelineNext): Promise<void> {
    const header = envelope.get('x-session')

    if (header) {
      const session = JSON.parse(header) as MockSession
      this.replayed.push(session)
      // run the rest of the chain (and the handler) inside the re-established session
      await sessionStore.run(session, next)
      return
    }

    await next()
  }
}

// ─── Event + listener under test ─────────────────────────────────────────────
// Schema attached the same way service DTOs do it (cf. UserEntity @Implements(UserSchema)).
// With MessagingModule.forRoot({ validate: true }) the ValidatingCodec enforces it on the wire.
const GreetingSchema = object(
  {
    message: string().min(1),
    seq: number(),
  },
  'Greeting',
)

type GreetingShape = InferObject<typeof GreetingSchema>

@Event({ name: 'integration.greeting' })
@Implements(GreetingSchema)
class Greeting implements GreetingShape {
  message!: string
  seq!: number
}

/** Build a Greeting instance from its fields (no constructor on the event class). */
const greeting = (message: string, seq: number): Greeting => Object.assign(new Greeting(), { message, seq })

@Injectable()
class GreetingListener {
  readonly received: Greeting[] = []
  // the session visible (via AsyncLocalStorage) at the moment the handler runs
  readonly sessionsSeen: (MockSession | undefined)[] = []
  private waiters: ((event: Greeting) => void)[] = []

  /** Resolves with the next event delivered after this call. */
  next(): Promise<Greeting> {
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  @Handle(Greeting, { queue: 'integration-test' })
  on(event: Greeting): void {
    this.received.push(event)
    this.sessionsSeen.push(sessionStore.getStore())
    this.waiters.shift()?.(event)
  }
}

// ─── Test suite ───────────────────────────────────────────────────────────────
// Boots a complete NestJS application context: MessagingModule.forRoot() starts
// the transport on app.init() and wires @Handle methods. The same scenarios run
// against both transports (core NATS + JetStream) through the MessageTransport seam.
// Requires a running NATS broker (JetStream enabled) at NATS_URL.
describe.each(TRANSPORTS)('messaging integration — $name', ({ useStream, provider }) => {
  let app: TestingModule
  let manager: EventManager
  let listener: GreetingListener

  beforeAll(async () => {
    if (useStream) await deleteStream()

    app = await Test.createTestingModule({
      imports: [MessagingModule.forRoot({ transport: provider(), validate: true })],
      // SessionPipeline is auto-registered by its @EnvelopePipeline decorator and
      // provided/constructed by MessagingModule — no need to list it here.
      providers: [GreetingListener],
    }).compile()

    // app.init() triggers onApplicationBootstrap → transport.start() + handler wiring.
    await app.init()

    manager = app.get(EventManager)
    listener = app.get(GreetingListener)
  })

  afterAll(async () => {
    // app.close() triggers onApplicationShutdown → transport.drain().
    await app?.close()
    if (useStream) await deleteStream()
  })

  it('delivers a sent event to the @Handle method', async () => {
    const arrived = listener.next()

    await manager.send(greeting('hello', 1))

    const event = await arrived
    expect(event).toBeInstanceOf(Greeting)
    expect(event.message).toBe('hello')
    expect(event.seq).toBe(1)
  })

  it('delivers multiple events in order', async () => {
    const before = listener.received.length

    await manager.send(greeting('a', 2))
    await manager.send(greeting('b', 3))

    await vi.waitFor(() => expect(listener.received.length).toBe(before + 2))

    const last = listener.received.slice(before)
    expect(last.map((e) => e.message)).toEqual(['a', 'b'])
  })

  it('rejects an event that violates its @Implements schema (ValidatingCodec)', async () => {
    const before = listener.received.length

    // message must be min(1) — empty string fails the schema on encode, before it ever hits the wire
    await expect(manager.send(greeting('', 1))).rejects.toThrow()

    // nothing was published, so the handler never fired
    expect(listener.received.length).toBe(before)
  })

  it('captures the session on send and replays it on receive (symmetric pipeline)', async () => {
    const pipeline = app.get(SessionPipeline)
    const session: MockSession = { userId: 'u-42', name: 'Alice' }
    const arrived = listener.next()

    // send inside a session context — the pipeline stamps it into the envelope header
    await sessionStore.run(session, () => manager.send(greeting('with-session', 9)))

    const event = await arrived
    expect(event.message).toBe('with-session')

    // capture (send side): the session was stamped into the outgoing header
    const captured = pipeline.captured.find((c: { subject: string }) => c.subject === 'integration.greeting')
    expect(captured).toBeDefined()
    expect(JSON.parse(captured!.session) as MockSession).toEqual(session)

    // replay (receive side): the pipeline re-established the session from the header...
    expect(pipeline.replayed).toContainEqual(session)

    // ...so the handler actually ran *inside* the original session, end-to-end over NATS
    expect(listener.sessionsSeen.at(-1)).toEqual(session)
  })
})
