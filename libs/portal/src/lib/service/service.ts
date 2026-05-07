import {
  Injectable,
  Type,
  Module,
  DynamicModule,
  OnModuleInit
} from '@nestjs/common';

import { ModuleRef } from  '@nestjs/core';
import 'reflect-metadata';

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
  call(descriptor: ServiceDescriptor, method: string, ...args: any[]): Promise<any>;
}

interface ChannelDescriptor {
  name: string
  type: Type<Channel>
}

@Injectable()
export class ChannelFactory {
  // static

  static channels : Map<string,ChannelDescriptor> = new Map()

  // constructor

  constructor(private moduleRef: ModuleRef) {}

  // private

  private findChannelType(channel: string) :Type<Channel> {
    return ChannelFactory.channels.get(channel)!.type!
  }

  // public

  create(channel: string): Channel {
    return this.moduleRef.get(this.findChannelType(channel), { strict: false });
  }
}

// decorator

export function DeclareChannel(name: string): ClassDecorator {
  return (target) => {
    ChannelFactory.channels.set(name, {name: name, type: target as unknown as Type<Channel>});
  };
}

// some channels

@DeclareChannel('local')
@Injectable()
export class LocalChannel implements Channel {
  // implement channel

  async call(descriptor: ServiceDescriptor, method: string, ...args: any[]) {
    return descriptor.instance![method](...args);
  }
}

@Module({})
export class ChannelModule {
  static register(): DynamicModule {
    return {
      module: ChannelModule,
      providers: [
        ...[...ChannelFactory.channels.values()].map(descriptor => descriptor.type),
        ChannelFactory,
      ],
      exports: [ChannelFactory],
    };
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

  componentDescriptor! : ComponentDescriptor

  // constructor

  constructor(public name: string, public type: Type<T>) {
    super(name,  type)
  }
}

export class ComponentDescriptor<T extends Component=Component> extends Descriptor<T> {
  // instance data

  addresses: ChannelAddress[] = [];

  constructor(public name: string, public type: AbstractType<T>, public services: ServiceDescriptor[]) {
    super(name, type)

    // link

    for ( const service of services)
      service.componentDescriptor = this
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

@Injectable()
export class ComponentRegistry implements OnModuleInit {
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
  private byType =  new Map<AbstractType<Service>, Descriptor<Service>>();
  private proxies =  new Map<AbstractType<Service>, Service>();

  // constructor

  constructor(private channelFactory: ChannelFactory, private moduleRef: ModuleRef) {
    this.setup();
  }

  // implement OnModuleInit

  onModuleInit() {
    // createInstances() is called externally
  }

  // private

  async createInstances() {
    // implementations

    for (const implementation of ComponentRegistry.serviceImplementations) {
      const descriptor = this.findServiceDescriptor(implementation) as ServiceDescriptor

      if (!descriptor) throw new Error(`No descriptor found for ${implementation.name}`)

      descriptor.instance = await this.moduleRef.create(implementation);

      if ( descriptor.instance instanceof Component)
        descriptor.instance.startup()
    }
  }

  private setup() {
    // services

    for (const declaration of ComponentRegistry.serviceDeclarations)
      this.registerService(new ServiceDescriptor<any>(declaration.name, declaration.type))

    // components

    for (const declaration of ComponentRegistry.componentDeclarations)
      this.registerComponent(new ComponentDescriptor<any>(declaration.name, declaration.type, declaration.options.services.map(type => this.byType.get(type) as ServiceDescriptor)))
  }

  private findServiceDescriptor(type: AbstractType<Service>): Descriptor<Service> | undefined {
    let current: any = type;

    while (
      current &&
      current !== Function.prototype &&
      current !== Object &&
      current !== Object.prototype
    ) {
      const descriptor = this.byType.get(current);

      if (descriptor) {
        return descriptor as Descriptor<Service>;
      }

      current = Object.getPrototypeOf(current);
    }

    return undefined;
  }

  private registerService(serviceDescriptor: ServiceDescriptor<Service>) {
    this.byType.set(serviceDescriptor.type, serviceDescriptor)

    this.services.set(serviceDescriptor.name, serviceDescriptor)
  }

  private registerComponent(componentDescriptor: ComponentDescriptor<Component>) {
    this.byType.set(componentDescriptor.type, componentDescriptor)

    this.components.set(componentDescriptor.name, componentDescriptor)
  }

  // public

  getService<T extends Service>(type: abstract new (...args: any[]) => T): T {
    const cached = this.proxies.get(type as any);

    if (cached) {
      return cached as T;
    }

    const descriptor = this.findServiceDescriptor(type) as ServiceDescriptor<T>;

    if (!descriptor) {
      throw new Error(
        `Unknown service ${type.name}`,
      );
    }

    const proxy = new Proxy(
      {},
      {
        get: (_, prop: string) => {
          if (prop === 'then') { // TODO
            return undefined;
          }

          const channel = descriptor.instance
            ? this.channelFactory.create('local')
            : (() => {
                const addresses = descriptor.componentDescriptor.addresses;

                if (!addresses.length) {
                  throw new Error(
                    `No address for component ${descriptor.componentDescriptor.name}`,
                  );
                }

                return this.channelFactory.create(addresses[0].channel);
              })();

          return async (...args: any[]) => channel.call(descriptor, prop, ...args);
        },
      },
    ) as T;

    this.proxies.set(type, proxy);

    return proxy;
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

@Module({})
export class ComponentModule {
  static forModule(component: AbstractType<Component>): DynamicModule {
    const services = ComponentRegistry.serviceDeclarations.map(s => s.type);

    const providers: any[] = [
      component,
      ComponentRegistry,
      ...services.map((svc) => ({
        provide: svc as Type<Service>,
        useFactory: (registry: ComponentRegistry) => registry.getService(svc),
        inject: [ComponentRegistry],
      })),
    ];

    return {
      module: ComponentModule,
      imports: [ChannelModule.register()],
      providers,
      exports: [ComponentRegistry, component, ...services],
    };
  }
}