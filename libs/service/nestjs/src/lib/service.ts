/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  Inject,
  Type,
  Module,
  DynamicModule,
  OnModuleInit,
  Get,
  Query,
} from '@nestjs/common';
import { applySwaggerToController } from './swagger';

import { AbstractType, CachingChannelFactory, Channel, ChannelAddress, ChannelFactory, Component, ComponentDescriptor, Service, ServiceDescriptor, ServiceRegistry } from '@svx/service-common';

import { ModuleRef } from  '@nestjs/core';
import { ProxyBuilder } from '@svx/service-common';


@Injectable()
export class ChannelBuilder {
  // static

  static factoryTypes: Map<string, Type<ChannelFactory>>  = new Map();

  static declareFactory(name: string, type: Type<ChannelFactory>) {
    ChannelBuilder.factoryTypes.set(name, type)
  }

  // instance data

  private factories = new Map<string, ChannelFactory>();
  private cache = new Map<string, Channel>();

  // constructor

  constructor(private moduleRef: ModuleRef) {
  }

  // private

  private findFactoryType(channel: string) : Type<ChannelFactory> {
    const type = ChannelBuilder.factoryTypes.get(channel)
    if (!type) {
      throw new Error(`No factory declared for channel ${channel}`)
    }

    return type
  }

  private findFactory(channel: string) : ChannelFactory {
    let factory = this.factories.get(channel)
    if (!factory ) {
      this.factories.set(channel, factory = this.moduleRef.get(this.findFactoryType(channel), { strict: false })!)
    }

    return factory
  }


  private buildCacheKey(channel: string, url?: string): string {
    return `${channel}:${url ?? ''}`;
  }

  create(channel: string, url?: string, metadata?: any): Channel {
    const key = this.buildCacheKey(channel, url);

    const cached = this.cache.get(key);
    if (cached)
      return cached;

    const factory = this.findFactory(channel);
    const instance = metadata && (factory as any).createWithMetadata
      ? (factory as any).createWithMetadata(url!, metadata)
      : factory.create(url!)

    this.cache.set(key, instance);

    return instance;
  }

  metadataFor(channel: string, descriptor: ComponentDescriptor<Component>): Promise<any> | undefined {
    const factory = this.findFactory(channel);
    return factory.metadataFor?.(descriptor);
  }
}

// decorator

export function DeclareChannel(name: string): ClassDecorator {
  return (target) => {
    ChannelBuilder.declareFactory(name, target as unknown as Type<ChannelFactory>);
  };
}

@DeclareChannel("missing")
export class MissingChannelFactory extends CachingChannelFactory<MissingChannel> {
  // implement

  createChannel(url: string) {
    const channel =  new MissingChannel()

    channel.url = url

    return channel
  }
}



@Injectable()
export class MissingChannel implements Channel {
  url!: string

  // implement

  async call(_descriptor: ServiceDescriptor, _method: string, ..._args: any[]): Promise<any> {
    throw Error("missing channel for " + this.url);
  }
}


@Module({})
export class ChannelModule {
  static register(): DynamicModule {
    const channelTypes = [...ChannelBuilder.factoryTypes.values()]

    const imports   = channelTypes.flatMap(t => (t as any).imports   ?? [])
    const providers = channelTypes.flatMap(t => (t as any).providers ?? [])

    return {
      module: ChannelModule,
      imports:   [...new Set(imports)],
      providers: [...channelTypes, ...providers, ChannelBuilder],
      exports:   [ChannelBuilder],
    }
  }
}

type AbstractConstructor<T> = abstract new (...args: any[]) => T;

export function NestComponent<TBase extends AbstractConstructor<Component>>(
  Base: TBase,
) {
  abstract class Mixin extends Base {
    @Inject(ChannelBuilder)
    channelBuilder!: ChannelBuilder;

    protected constructor(...args: any[]) {
      super(...args);
    }

    @Get('channel-metadata')
    async getChannelMetadata(@Query('channel') channel = 'rest') {
      const descriptor = ServiceRegistry.instance.findServiceDescriptor(
        this.constructor as any,
      ) as ComponentDescriptor<Component>;
      return this.channelBuilder.metadataFor(channel, descriptor);
    }
  }
  return Mixin;
}

export abstract class AddressResolution {
  abstract select(addresses: ChannelAddress[]): ChannelAddress;
}

@Injectable()
export class DefaultAddressResolution extends AddressResolution {
  private readonly priority: string[];

  constructor(...priority: string[]) {
    super();

    this.priority = priority;
  }

  select(addresses: ChannelAddress[]): ChannelAddress {
    if (!addresses.length) {
      return new ChannelAddress('missing', 'unknown');
    }

    for (const p of this.priority) {
      const match = addresses.find(a => a.channel === p);
      if (match)
        return match;
    }

    return addresses[0]; // ? is a fallback ok?
  }
}


export abstract class ComponentDiscovery {
  abstract register(component: ComponentDescriptor<Component>) : void
  abstract deregister(component: ComponentDescriptor<Component>) : void

  abstract getAddresses(component: string) : ChannelAddress[]
}

@Injectable()
export class LocalComponentDiscovery extends ComponentDiscovery {
  // instance data

  components = new Map<string,ComponentDescriptor<Component>>()
  // implement

  register(component: ComponentDescriptor<Component>) : void {
    this.components.set(component.name, component)
  }

  deregister(component: ComponentDescriptor<Component>) : void {
    this.components.delete(component.name)
  }

  getAddresses(component: string) : ChannelAddress[] {
    const descriptor = this.components.get(component)
    if ( descriptor )
      return descriptor.addresses
    else
      return []
  }
}

export interface GetServiceOptions {
  channel?: string;   // force a specific channel, e.g. 'local' | 'http' | ...
  url?: string;       // force a specific url (overrides discovery)
}

@Injectable()
export class ComponentRegistry implements OnModuleInit { // TODO rename, TODO: OnModuleInit
  // static

  static serviceImplementations : Type<Service>[] = []

  static implementService(target: Type<Service>) {
    ComponentRegistry.serviceImplementations.push(target)
  }

  // instance data

  private proxies =  new Map<string, Service>();
  private serviceRegistry: ServiceRegistry = new ServiceRegistry()

  // constructor

  constructor(@Inject(ChannelBuilder) private channelFactory: ChannelBuilder, private moduleRef: ModuleRef, private discovery: ComponentDiscovery, private addressResolution: AddressResolution) {
  }

  report() : string {
    return this.serviceRegistry.report()
  }

  // implement OnModuleInit

  async onModuleInit() {
    await this.createInstances()
  }

  // private

  async createInstances() {
    // implementations

    for (const implementation of ComponentRegistry.serviceImplementations) {
      const descriptor = this.serviceRegistry.findServiceDescriptor(implementation) as ServiceDescriptor

      if (!descriptor) throw new Error(`No descriptor found for ${implementation.name}`)

      descriptor.instance = this.moduleRef.get(implementation, { strict: false });

      if ( descriptor instanceof ComponentDescriptor) {
        descriptor.addresses = descriptor.instance.addresses

        // ensure local channel exists when an instance is available
        const hasLocal = descriptor.addresses.some(a => a.channel === 'local');

        if (!hasLocal && descriptor.instance) {
          descriptor.addresses = [
            new ChannelAddress('local', 'local'),
            ...descriptor.addresses,
          ];
        }

        this.discovery.register(descriptor)
        await descriptor.instance.startup()
      }
    }
  }

  private pickAddress(component: ComponentDescriptor<Component>) : ChannelAddress {
    return this.addressResolution.select(component.addresses)
  }

  findDescriptor<T extends Component>(component: AbstractType<T>) : ComponentDescriptor<T> {
    return this.serviceRegistry.findServiceDescriptor<T>(component) as ComponentDescriptor<T>
  }

  // public

  private proxyKey(type: AbstractType<Service>, opts?: GetServiceOptions): string {
    return `${type.name}:${opts?.channel ?? ''}:${opts?.url ?? ''}`;
  }

  getService<T extends Service>(type: AbstractType<T>, opts?: GetServiceOptions): T {
    const key = this.proxyKey(type, opts)
    let proxy = this.proxies.get(key)
    if (!proxy ) {
      const descriptor = this.serviceRegistry.findServiceDescriptor(type)
      const builder = new ProxyBuilder<T>(type)

      if (opts?.channel) {
        // explicit channel: bind eagerly
        if (opts.channel === 'local') {
          builder.bind((name, ...args) => (descriptor.instance as any)[name](...args))
        }
        else {
          const channel = this.channelFactory.create(opts.channel)
          builder.bind((name, ...args) => channel.call(descriptor, name, ...args))
        }
      }
      else {
        // lazy — first call picks address, binds all
        builder.lazy(async () => {
          const address = this.pickAddress(descriptor.componentDescriptor)

          if (address.channel === 'local') {
            builder.bind((name, ...args) => (descriptor.instance as any)[name](...args))
          }
          else {
            const metadata = await descriptor.componentDescriptor.instance?.channelMetadata(address.channel, descriptor.componentDescriptor)
            const channel = this.channelFactory.create(address.channel, address.uri, metadata)
            builder.bind((name, ...args) => channel.call(descriptor, name, ...args))
          }
        })
      }

      // create and cache

      this.proxies.set(key, proxy = builder.build())
    }

    return proxy as T
  }
}

export function Implementation<T extends Service>(): ClassDecorator {
  return (target) => {
    ComponentRegistry.implementService(target as any as Type<T>)
    applySwaggerToController(target)
  }
}

export interface ComponentModuleOptions {
  discovery:  AbstractType<ComponentDiscovery>
  components: AbstractType<Component>[]
  addressResolution: AddressResolution
  imports?: any[]
}

@Module({})
export class ComponentModule {
   static forRoot(options: ComponentModuleOptions): DynamicModule {
      const { components } = options;

      const services = ServiceRegistry.serviceDeclarations.map(s => s.type);
      const implementations = ComponentRegistry.serviceImplementations;
      const controllers = implementations.filter(impl => Reflect.getMetadata('path', impl) !== undefined);

      const providers: any[] = [
        {
          provide: ComponentDiscovery,
          useClass: options.discovery,
        },
        {
          provide: AddressResolution,
          useValue: options.addressResolution,
        },

        ...components,
        ...implementations,

        ComponentRegistry,

        ...services.map((svc) => ({
          provide: svc as AbstractType<Service>,
          useFactory: (registry: ComponentRegistry) => registry.getService(svc),
          inject: [ComponentRegistry],
        })),
      ];

      return {
        module: ComponentModule,
        imports: [ChannelModule.register(), ...(options.imports ?? [])],
        providers,
        controllers,
        exports: [
          ChannelModule,
          ComponentRegistry,
          ...components,
          ...services,
        ],
      };
    }
}
