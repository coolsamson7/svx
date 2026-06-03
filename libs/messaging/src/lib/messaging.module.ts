import {
  DynamicModule,
  Module,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Provider,
} from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { EventManager } from './event-manager'
import { registeredHandlers } from './handle.decorator'
import { EnvelopePipeline, registeredPipelines } from './pipeline'
import { MessageTransport } from './transport'

/**
 * Options for {@link MessagingModule.forRoot}.
 */
export interface MessagingModuleOptions {
  /** a provider that binds the {@link MessageTransport} token (e.g. <code>natsTransport(...)</code>). */
  transport: Provider
  /** optional extra providers. */
  providers?: Provider[]
}

/**
 * Wires the messaging runtime into a NestJS application. No runtime discovery: {@link EnvelopePipeline}
 * classes (from the <code>@EnvelopePipeline</code> registry) are added to this module's providers so
 * Nest constructs them via DI, and handlers (from the <code>@Handle</code> registry) are resolved
 * from the container at bootstrap. On bootstrap the transport starts, pipelines are chained and a
 * subscription is registered per handler; on shutdown the transport stops.
 */
@Module({})
export class MessagingModule implements OnApplicationBootstrap, OnApplicationShutdown {
  // constructor

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly manager: EventManager,
  ) {}

  // static

  static forRoot(options: MessagingModuleOptions): DynamicModule {
    return {
      module: MessagingModule,
      global: true,
      // pipeline classes become providers → constructed via DI
      providers: [options.transport, ...registeredPipelines(), ...(options.providers ?? []), EventManager],
      exports: [EventManager, MessageTransport],
    }
  }

  // lifecycle

  async onApplicationBootstrap(): Promise<void> {
    // chain pipelines (ordered, DI-constructed) in front of the transport
    const pipelines = registeredPipelines()
      .map((cls) => this.resolve<EnvelopePipeline>(cls))
      .filter((pipeline): pipeline is EnvelopePipeline => !!pipeline)

    if (pipelines.length > 0) this.manager.setPipelines(pipelines)

    await this.manager.start()

    // register a subscription per @Handle, resolving the declaring instance from DI
    for (const handler of registeredHandlers()) {
      const instance = this.resolve<Record<string, (event: unknown) => unknown>>(handler.owner)
      if (!instance) continue // owner is not part of this application

      const callback = instance[handler.method].bind(instance)
      const name = handler.options.name ?? `${handler.owner.name}.${handler.method}`

      await this.manager.subscribe(handler.event, callback, name, handler.options)
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.manager.stop()
  }

  // internal

  private resolve<T>(cls: Function): T | undefined {
    try {
      return this.moduleRef.get(cls as never, { strict: false })
    } catch {
      return undefined
    }
  }
}
