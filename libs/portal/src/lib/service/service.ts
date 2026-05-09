/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  Type,
  Module,
  DynamicModule,
  OnModuleInit,
  Scope
} from '@nestjs/common';

import { ModuleRef } from  '@nestjs/core';
import { StringBuilder } from '../util';

export type AbstractType<T> = abstract new (...args: any[]) => T;

export class Service {}

export abstract class Component extends Service {
  abstract startup(): Promise<void>;
  abstract shutdown(): Promise<void>;
  abstract get addresses(): ChannelAddress[];
}

export class ChannelAddress {
  constructor(
    public channel: string,
    public uri: string,
  ) {}
}

export interface Channel {
  url?: string;
  call(descriptor: ServiceDescriptor, method: string, ...args: any[]): Promise<any>;
}

interface ChannelDescriptor {
  name: string
  type: Type<Channel>
}

@Injectable()
export class ChannelFactory {
  // static

  static channels: Map<string, ChannelDescriptor> = new Map();

  // instance data

  private cache = new Map<string, Channel>();

  // constructor

  constructor(private moduleRef: ModuleRef) {}

  // private

  private find(name: string): Type<Channel> {
    const type = ChannelFactory.channels.get(name)
    if (type)
      return type.type;
    else
      throw new Error(`Channel not found: ${name}`);
  }

  private buildCacheKey(
    channel: string,
    url?: string,
  ): string {
    return `${channel}:${url ?? ''}`;
  }

  create(channel: string, url?: string): Channel {
    const key = this.buildCacheKey(channel, url);

    const cached = this.cache.get(key);
    if (cached)
      return cached;


    const instance = this.moduleRef.get(this.find(channel), { strict: false });

    instance.url = url;

    this.cache.set(key, instance);

    return instance;
  }
}

// decorator

export function DeclareChannel(name: string): ClassDecorator {
  return (target) => {
    ChannelFactory.channels.set(name, {name: name, type: target as unknown as Type<Channel>});
  };
}


@DeclareChannel("missing")
@Injectable()
export class MissingChannel implements Channel {
  url!: string

  // implement

  async call(_descriptor: ServiceDescriptor, _method: string, ..._args: any[]): Promise<any> {
    throw Error("missing channel for " + this.url);
  }
}


import { HttpModule } from '@nestjs/axios';
import { TypeDescriptor } from '../reflection';

@Module({})
export class ChannelModule {
  static register(): DynamicModule {
    const channelTypes = [...ChannelFactory.channels.values()].map(d => d.type)

    const imports   = channelTypes.flatMap(t => (t as any).imports   ?? [])
    const providers = channelTypes.flatMap(t => (t as any).providers ?? [])

    return {
      module: ChannelModule,
      imports:   [...new Set(imports)],           // deduplicate HttpModule etc.
      providers: [...channelTypes, ...providers, ChannelFactory],
      exports:   [ChannelFactory],
    }
  }
}

/* =========================================
   Component Descriptor & Registry
========================================= */

export class Descriptor<T extends Service> {
  // instance data

  instance?: T

  // constructor

  constructor(public name: string, public type: AbstractType<T>) {}
}

export class ServiceDescriptor<T extends Service=Service> extends Descriptor<T> {
  // instance data

  componentDescriptor! : ComponentDescriptor<Component>

  // constructor

  constructor(public name: string, public type: AbstractType<T>) {
    super(name,  type)
  }

  report(builder: StringBuilder) {
    builder.append("\t").append(this.name)

    if ( this.instance )
      builder.append(" implemented by ").append(this.instance.constructor.name)
  }
}

export class ComponentDescriptor<T extends Component> extends ServiceDescriptor<T> {
  // instance data

  addresses: ChannelAddress[] = [];

  constructor(public name: string, public type: AbstractType<T>, public services: ServiceDescriptor[]) {
    super(name, type)

    // link

    for ( const service of services)
      service.componentDescriptor = this
  }

  // public

  report(builder: StringBuilder) {
    builder.append(this.name)
    if ( this.instance )
      builder.append(" implemented by ").append(this.instance.constructor.name)

    builder.append("\n")

    for ( const service of this.services)
      service.report(builder)
  }
}

export interface ServiceOptions {
  name: string
}

export interface ComponentOptions extends ServiceOptions {
  services: AbstractType<Service>[];
}

interface ComponentDeclaration {
  name: string
  type: Type<Component>
  options: ComponentOptions
}


interface ServiceDeclaration {
  name: string
  type: Type<Component>
  options: ServiceOptions
}

export abstract class AddressResolution {
  abstract select(addresses: ChannelAddress[]): ChannelAddress;
}

@Injectable()
export class DefaultAddressResolution extends AddressResolution {
  private priority: string[];

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

@Injectable()
export class ComponentRegistry implements OnModuleInit { // TODO rename, TODO: OnModuleInit
  // static

  static componentDeclarations : ComponentDeclaration[] = []
  static serviceDeclarations : ServiceDeclaration[] = []
  static serviceImplementations : Type<Service>[] = []

  static declareComponent(target: any, options: ComponentOptions) {
    ComponentRegistry.componentDeclarations.push({name: options.name, type: target, options: options})
  }

  static declareService(target: any, options: ServiceOptions) {
    ComponentRegistry.serviceDeclarations.push({name: options.name, type: target, options: options})
  }

  static implementService(target: Type<Service>) {
    ComponentRegistry.serviceImplementations.push(target)
  }

  // instance data

  private components = new Map<string, ComponentDescriptor<Component>>();
  private services = new Map<string, ServiceDescriptor<Service>>();
  private byType =  new Map<AbstractType<Service>, ServiceDescriptor>();
  private proxies =  new Map<AbstractType<Service>, Service>();

  // constructor

  constructor(private channelFactory: ChannelFactory, private moduleRef: ModuleRef, private discovery: ComponentDiscovery, private addressResolution: AddressResolution) {
    this.setup();
  }

  report() : string {
    const builder = new StringBuilder()

    builder.append("Components\n")

    for ( const component of this.components.values())
      component.report(builder)

    return builder.toString()
  }

  // implement OnModuleInit

  async onModuleInit() {
    await this.createInstances()
  }

  // private

  async createInstances() {
    // implementations

    for (const implementation of ComponentRegistry.serviceImplementations) {
      const descriptor = this.findServiceDescriptor(implementation) as ServiceDescriptor

      if (!descriptor) throw new Error(`No descriptor found for ${implementation.name}`)

      descriptor.instance = await this.moduleRef.create(implementation);

      if ( descriptor instanceof ComponentDescriptor) {
        descriptor.addresses = descriptor.instance.addresses

        // 👇 ensure local channel exists when an instance is available
        const hasLocal = descriptor.addresses.some(a => a.channel === 'local');

        if (!hasLocal && descriptor.instance) {
          descriptor.addresses = [
            new ChannelAddress('local', 'local'),
            ...descriptor.addresses,
          ];
        }

        this.discovery.register(descriptor)
        descriptor.instance.startup()
      }
    }
  }

  private setup() {
    // services

    for (const declaration of ComponentRegistry.serviceDeclarations)
      this.registerService(new ServiceDescriptor(declaration.name, declaration.type))

    // components

    for (const declaration of ComponentRegistry.componentDeclarations)
      this.registerComponent(new ComponentDescriptor(declaration.name, declaration.type, declaration.options.services.map(type => this.byType.get(type) as ServiceDescriptor)))
  }

  private findServiceDescriptor(type: AbstractType<Service>): ServiceDescriptor {
    let current = type;

    while (
      current &&
      current !== Function.prototype &&
      current !== Object &&
      current !== Object.prototype
    ) {
      const descriptor = this.byType.get(current);

      if (descriptor) {
        return descriptor;
      }

      current = Object.getPrototypeOf(current);
    }

    throw new Error(`Unknown service ${type.name}`)
  }

  private registerService(serviceDescriptor: ServiceDescriptor<Service>) {
    this.byType.set(serviceDescriptor.type, serviceDescriptor)

    this.services.set(serviceDescriptor.name, serviceDescriptor)
  }

  private registerComponent(componentDescriptor: ComponentDescriptor<Component>) {
    this.byType.set(componentDescriptor.type, componentDescriptor)

    this.components.set(componentDescriptor.name, componentDescriptor)
  }

  private pickAddress(component: ComponentDescriptor<Component>) : ChannelAddress {
    return this.addressResolution.select(component.addresses)
  }

  // public

  getService<T extends Service>(type: AbstractType<T>): T {
    const cached = this.proxies.get(type);
    if (cached) return cached as T;

    const descriptor = this.findServiceDescriptor(type);
    const methods = TypeDescriptor.forType(type as any).getMethods();
    const proxy = Object.create((type as any).prototype);

    const bindRemote = (address: ChannelAddress) => {
      const channel = this.channelFactory.create(address.channel, address.uri);

      for (const method of methods) {
        const name = method.name;
        proxy[name] = (...args: any[]) =>
          channel.call(descriptor, name, ...args);
      }
    };

    const bindLocal = () => {
      const instance = descriptor.instance;
      if (!instance) {
        throw new Error(`No local instance for ${descriptor.name}`);
      }

      for (const method of methods) {
        const name = method.name;
        proxy[name] = (...args: any[]) =>
          (instance as any)[name](...args);
      }
    };

    const installStubs = () => {
      for (const method of methods) {
        const name = method.name;

        proxy[name] = (...args: any[]) => {
          // pick address ONCE per first call
          const address = this.pickAddress(descriptor.componentDescriptor);

          if (address.channel === 'local') {
            bindLocal();
          } else {
            bindRemote(address);
          }

          return proxy[name](...args);
        };
      }
    };

    installStubs();

    this.proxies.set(type, proxy);
    return proxy as T;
  }
}

// decorator

export function DeclareComponent(options: ComponentOptions): ClassDecorator {
  return (target) => {
    ComponentRegistry.declareComponent(target, options)
  };
}

export function DeclareService(options: ServiceOptions): ClassDecorator {
  return (target) => {
    ComponentRegistry.declareService(target, options)
  };
}

export function Implementation<T extends Service>(): ClassDecorator {
  return (target) => {
    ComponentRegistry.implementService(target as any as Type<T>  )
  };
}

export interface ComponentModuleOptions {
  discovery:  AbstractType<ComponentDiscovery>
  components: AbstractType<Component>[]
  addressResolution: AddressResolution
}

@Module({})
export class ComponentModule {
   static forRoot(options: ComponentModuleOptions): DynamicModule {
      const { components } = options;

      const services = ComponentRegistry.serviceDeclarations.map(s => s.type);

      const providers: any[] = [
        {
          provide: ComponentDiscovery,
          useClass: options.discovery,
        },
        {
          provide: AddressResolution,
          useValue: options.addressResolution,
        },

        ...components,                                   // register each component class

        ComponentRegistry,

        ...services.map((svc) => ({
          provide: svc as Type<Service>,
          useFactory: (registry: ComponentRegistry) => registry.getService(svc),
          inject: [ComponentRegistry],
        })),
      ];

      return {
        module: ComponentModule,
        imports:   [ChannelModule.register()],
        providers,
        exports:   [ComponentRegistry, ...components, ...services],
      };
    }
}
