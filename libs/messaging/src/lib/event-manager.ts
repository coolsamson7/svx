import { randomUUID } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import { Envelope } from './envelope'
import { EventDescriptor, EventRegistry, EventType } from './event.decorator'
import { HandleOptions } from './handle.decorator'
import { EnvelopePipeline, PipelineNext } from './pipeline'
import { EventCallback, EventSubscription } from './subscription'
import { DeliverFn, MessageTransport } from './transport'

type Direction = 'send' | 'receive'

/**
 * Central entry point for sending and dispatching events. Owns the {@link MessageTransport} and the
 * symmetric {@link EnvelopePipeline} chain: pipelines run forward on send (terminus = publish) and
 * in reverse on receive (terminus = the handler). Tracks active {@link EventSubscription}s.
 */
@Injectable()
export class EventManager {
  // instance data

  private readonly logger = new Logger(EventManager.name)
  private readonly subscriptions = new Map<string, EventSubscription>()
  private pipelines: EnvelopePipeline[] = []

  // constructor

  constructor(private readonly transport: MessageTransport) {}

  // lifecycle

  async start(): Promise<void> {
    await this.transport.start()
  }

  async stop(): Promise<void> {
    await this.transport.stop()
  }

  /**
   * Sets the {@link EnvelopePipeline} chain. Forward order applies to the send path; the reverse
   * order applies to the receive path (onion symmetry).
   */
  setPipelines(pipelines: EnvelopePipeline[]): void {
    this.pipelines = pipelines
  }

  // public

  /**
   * Register a subscription and set up the underlying transport subscription. Each subscription
   * maps exactly one handler to one event.
   */
  async subscribe(event: EventType | string, callback: EventCallback, name = '', options: HandleOptions = {}): Promise<string> {
    const descriptor = typeof event === 'string' ? EventRegistry.forName(event) : EventRegistry.forType(event)

    const id = randomUUID()
    const subscription = new EventSubscription(id, descriptor, callback, name || `subscription_${id.slice(0, 8)}`, options)

    this.subscriptions.set(id, subscription)

    const deliver: DeliverFn = (envelope) =>
      this.runChain('receive', envelope, descriptor, async () => {
        await subscription.callback(envelope.event)
      })

    await this.transport.subscribe(subscription, deliver)

    this.logger.log(`Subscribed to '${descriptor.name}' (${subscription.name})`)

    return id
  }

  listSubscriptions(): EventSubscription[] {
    return [...this.subscriptions.values()]
  }

  /**
   * Send an event through the send pipeline chain to the transport.
   */
  async send(event: object): Promise<void> {
    const descriptor = EventRegistry.forType(event.constructor as EventType)
    const envelope = this.transport.createSendEnvelope(event, descriptor)

    await this.runChain('send', envelope, descriptor, () => this.transport.send(envelope, descriptor))
  }

  // internal

  /**
   * Runs the pipeline chain for a direction and ends at <code>terminus</code>. Send uses forward
   * order; receive uses reverse order. Pipelines that do not implement the direction are skipped.
   */
  private runChain(direction: Direction, envelope: Envelope, descriptor: EventDescriptor, terminus: PipelineNext): Promise<void> {
    const pipelines = direction === 'send' ? this.pipelines : [...this.pipelines].reverse()

    const dispatch = (index: number): Promise<void> => {
      const pipeline = pipelines[index]
      if (!pipeline) return terminus()

      const step = pipeline[direction]
      if (!step) return dispatch(index + 1)

      return step.call(pipeline, envelope, descriptor, () => dispatch(index + 1))
    }

    return dispatch(0)
  }
}
