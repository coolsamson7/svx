import { Injectable, Type, Inject, Module, ModuleMetadata } from '@nestjs/common';
import 'reflect-metadata';

/* =========================================
   Base Types
========================================= */

export class Service {}

export abstract class Component implements Service {
  abstract startup(): Promise<void>;
  abstract shutdown(): Promise<void>;
  abstract get addresses(): ChannelAddress[];
}

export class ChannelAddress {
  constructor(public channel: string, public uri: string) {}
}

export interface Channel {
  call(method: string, ...args: any[]): Promise<any>;
}

/* =========================================
   Decorators
========================================= */

const COMPONENT_META_KEY = 'custom:component';
const CHANNEL_META_KEY = 'custom:channel';

export interface ComponentOptions {
  services: Type<Service>[];
}

// Abstract component decorator
export function DeclareComponent(options: ComponentOptions): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(COMPONENT_META_KEY, options, target);
  };
}

export function getComponentMetadata(target: any): ComponentOptions {
  return Reflect.getMetadata(COMPONENT_META_KEY, target);
}

/* Channel registry */
const CHANNEL_REGISTRY = new Map<string, Type<Channel>>();
export function DeclareChannel(name: string): ClassDecorator {
  return (target) => {
    CHANNEL_REGISTRY.set(name, target as unknown as Type<Channel>);
    Reflect.defineMetadata(CHANNEL_META_KEY, name, target);
  };
}

/* Implementation registry */
const IMPLEMENTATION_REGISTRY = new Map<Type<any>, Type<any>[]>();

export function Implementation<T extends Component | Service>(abstractClass: Type<T>): ClassDecorator {
  return (target) => {
    const list = IMPLEMENTATION_REGISTRY.get(abstractClass) || [];
    list.push(target as unknown as Type<any>);
    IMPLEMENTATION_REGISTRY.set(abstractClass, list);
  };
}

export function getImplementations<T extends Component | Service>(abstractClass: Type<T>): Type<any>[] {
  return IMPLEMENTATION_REGISTRY.get(abstractClass) || [];
}

/* =========================================
   Channels
========================================= */

@DeclareChannel('local')
@Injectable()
export class LocalChannel implements Channel {
  constructor(private target: any) {}
  async call(method: string, ...args: any[]) {
    return this.target[method](...args);
  }
}

@DeclareChannel('http')
@Injectable()
export class HttpChannel implements Channel {
  constructor(private uri: string) {}
  async call(method: string, ...args: any[]) {
    const res = await fetch(`${this.uri}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return res.json();
  }
}

/* =========================================
   Channel Factory
========================================= */

@Injectable()
export class ChannelFactory {
  constructor() {}

  createChannel(componentInstance: Component, addr: ChannelAddress): Channel {
    const cls = CHANNEL_REGISTRY.get(addr.channel);
    if (!cls) throw new Error(`Unknown channel: ${addr.channel}`);
    if (addr.channel === 'local') return new cls(componentInstance); // DI could be used here too
    return new cls(addr.uri);
  }

  createProxy<T extends Service>(svc: Type<T>, channels: Channel[]): T {
    const methodNames = Object.getOwnPropertyNames(svc.prototype).filter(
      (m) => m !== 'constructor' && typeof svc.prototype[m] === 'function',
    );
    return new Proxy({} as T, {
      get(_, prop: string) {
        if (!methodNames.includes(prop)) return undefined;
        return async (...args: any[]) => channels[0].call(prop, ...args);
      },
    });
  }
}

/* =========================================
   Component Descriptor & Registry
========================================= */

export class ComponentDescriptor<T extends Component> {

  addresses: ChannelAddress[] = [];
  services: Type<Service>[] = [];
  constructor(public abstractType: Type<T>, public instance?: T) {}
}

@Injectable()
export class ComponentRegistry {
  private components = new Map<string, ComponentDescriptor<Component>>();

  constructor(private channelFactory: ChannelFactory) {}

  registerAllImplementations(moduleRef: any) {
    IMPLEMENTATION_REGISTRY.forEach((implClasses, abstractClass) => {
      implClasses.forEach((cls) => {
        const instance = moduleRef.get(cls); // let NestJS DI instantiate
        const descriptor = new ComponentDescriptor(abstractClass as any, instance);
        descriptor.addresses = instance.addresses;
        const meta = getComponentMetadata(abstractClass);
        descriptor.services = meta?.services || [];
        this.components.set(abstractClass.name, descriptor);
      });
    });
  }

  getServiceProxy<T extends Service>(abstractClass: Type<T>): T {
    const descriptor = this.components.get(abstractClass.name);
    if (!descriptor || !descriptor.instance) throw new Error('Component not found');
    const channels = descriptor.addresses.map((addr) =>
      this.channelFactory.createChannel(descriptor.instance!, addr),
    );
    return this.channelFactory.createProxy(abstractClass, channels);
  }
}

/* =========================================
   Dynamic Module
========================================= */

export function createComponentModule(component: Type<Component>): any {
  const meta = getComponentMetadata(component);

  const providers: any[] = [
    component,
    ChannelFactory,
    ComponentRegistry,
   ...(meta?.services || []).map((svc) => ({
  provide: svc as Type<Service>,
  useFactory: (registry: ComponentRegistry) => registry.getServiceProxy(svc),
  inject: [ComponentRegistry],
})),
  ];

  // create a proper dynamic module class
  @Module({
    providers,
    exports: providers,
  })
  class DynamicComponentModule {}

  return DynamicComponentModule;
}

/* =========================================
   Example
========================================= */

export abstract class UserServiceInterface extends Service {
  abstract createUser(name: string): Promise<string>;
}

@DeclareComponent({ services: [UserServiceInterface as Type<any>] })
export abstract class UserComponent extends Component {}

@Injectable()
@Implementation(UserComponent as Type<any>)
export class UserComponentImpl extends UserComponent {
  async startup() {}
  async shutdown() {}
  get addresses(): ChannelAddress[] {
    return [
      new ChannelAddress('local', ''), // local implementation
      new ChannelAddress('http', 'http://localhost:3000'), // remote
    ];
  }
  async createUser(name: string): Promise<string> {
    return `user-${name}`;
  }
}

/* =========================================
   Client
========================================= */

@Injectable()
export class ClientService {
  constructor(
    @Inject(UserServiceInterface) private userSvc: UserServiceInterface,
  ) {}
  async run() {
    const id = await this.userSvc.createUser('Alice');
    console.log('Got user id:', id);
  }
}

// TEST


import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';


describe('UserComponent & UserServiceInterface', () => {
  let moduleRef: TestingModule;
  let userService: UserServiceInterface;

  beforeEach(async () => {
    // create a dynamic NestJS testing module
    moduleRef = await Test.createTestingModule({
      imports: [createComponentModule(UserComponent as any)],
      providers: [ChannelFactory], // ensure factory is available
    }).compile();

    // retrieve the proxy for the abstract service
    userService = moduleRef.get(UserServiceInterface);
  });

  it('should return a proxy instance', () => {
    expect(userService).toBeDefined();
    expect(typeof userService.createUser).toBe('function');
  });

  it('should call the local method via proxy', async () => {
    const result = await userService.createUser('Alice');
    expect(result).toBe('user-Alice'); // local implementation returns this
  });
});
