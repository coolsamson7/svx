// -------------------- imports --------------------
import { Injectable, Module, Type, Inject, OnModuleInit } from '@nestjs/common';
import 'reflect-metadata';
import fetch from 'node-fetch';

// -------------------- 1️⃣ Abstract Interfaces --------------------
export abstract class Service {}

export abstract class Component extends Service {
  abstract startup(): Promise<void>;
  abstract shutdown(): Promise<void>;
  abstract getStatus(): string;
  abstract addresses: ChannelAddress[];
}

// -------------------- 2️⃣ Channel Address --------------------
export class ChannelAddress {
  constructor(
    public channel: string,
    public uri: string,
  ) {}
}

// -------------------- 3️⃣ Decorators --------------------

// --- Services & Components ---
export interface ComponentOptions {
  services: Type<Service>[];
}

export function ServiceDecorator(): ClassDecorator {
  return (target) => Reflect.defineMetadata('custom:isService', true, target);
}
export function Component(options: ComponentOptions): ClassDecorator {
  return (target) =>
    Reflect.defineMetadata('custom:component:options', options, target);
}

// --- Implementations ---
export function ServiceImpl(): ClassDecorator {
  return (target) =>
    Reflect.defineMetadata('custom:isServiceImpl', true, target);
}
export function ComponentImpl(): ClassDecorator {
  return (target) =>
    Reflect.defineMetadata('custom:isComponentImpl', true, target);
}

// --- Channels ---
export function Channel(): ClassDecorator {
  return (target) => Reflect.defineMetadata('custom:isChannel', true, target);
}

// --- Injection of abstract proxies ---
export function InjectService(token: Type<any>): PropertyDecorator {
  return Inject(token);
}

// -------------------- 4️⃣ Channels --------------------
export interface IChannel {
  call(method: string, ...args: any[]): Promise<any>;
}

@Channel()
@Injectable()
export class LocalChannel implements IChannel {
  constructor(private readonly instance: any) {}
  async call(method: string, ...args: any[]) {
    return this.instance[method](...args);
  }
}

@Channel()
@Injectable()
export class HttpChannel implements IChannel {
  constructor(private readonly address: ChannelAddress) {}
  async call(method: string, ...args: any[]) {
    const res = await fetch(`${this.address.uri}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`Remote call failed: ${method}`);
    return res.json();
  }
}

// -------------------- 5️⃣ ChannelFactory --------------------
@Injectable()
export class ChannelFactory {
  createChannel(address: ChannelAddress, localImpl?: any): IChannel {
    if (localImpl) return new LocalChannel(localImpl);
    if (address.channel === 'rest') return new HttpChannel(address);
    throw new Error(`Unsupported channel type: ${address.channel}`);
  }

  createProxy<T extends object>(
    serviceClass: Type<T>,
    channels: IChannel[],
  ): T {
    const allowedMethods = Object.getOwnPropertyNames(
      serviceClass.prototype,
    ).filter((m) => m !== 'constructor');

    return new Proxy({} as T, {
      get(_, prop: string) {
        if (!allowedMethods.includes(prop)) return undefined;
        return async (...args: any[]) => channels[0].call(prop, ...args);
      },
    });
  }
}

// -------------------- 6️⃣ ComponentDescriptor --------------------
export class ComponentDescriptor<T extends Component> {
  public channels: IChannel[] = [];
  public services: Map<Type<Service>, Service> = new Map();

  constructor(
    public readonly componentClass: Type<T>,
    public readonly localImpl: T,
    private readonly channelFactory: ChannelFactory,
  ) {}

  registerChannels() {
    for (const addr of this.localImpl.addresses || []) {
      const channel = this.channelFactory.createChannel(addr, this.localImpl);
      this.channels.push(channel);
    }
  }

  registerServices(services: Type<Service>[]) {
    for (const svc of services) {
      this.services.set(
        svc,
        this.channelFactory.createProxy(svc, this.channels),
      );
    }
  }

  acquireService<T extends Service>(svc: Type<T>): T {
    const proxy = this.services.get(svc);
    if (!proxy)
      throw new Error(
        `Service ${svc.name} not found on component ${this.componentClass.name}`,
      );
    return proxy as T;
  }
}

// -------------------- 7️⃣ ComponentRegistry --------------------
@Injectable()
export class ComponentRegistry implements OnModuleInit {
  private descriptors: Map<string, ComponentDescriptor<Component>> = new Map();

  constructor(private readonly channelFactory: ChannelFactory) {}

  registerComponent<T extends Component>(localImpl: T) {
    const compMeta: ComponentOptions = Reflect.getMetadata(
      'custom:component:options',
      localImpl.constructor,
    ) || { services: [] };
    const descriptor = new ComponentDescriptor(
      localImpl.constructor as Type<T>,
      localImpl,
      this.channelFactory,
    );
    descriptor.registerChannels();
    descriptor.registerServices(compMeta.services);
    this.descriptors.set(localImpl.constructor.name, descriptor);
  }

  getService<T extends Service>(cls: Type<T>): T {
    for (const desc of this.descriptors.values()) {
      if (desc.services.has(cls)) return desc.acquireService(cls);
    }
    throw new Error(`Service ${cls.name} not found`);
  }

  getComponent<T extends Component>(cls: Type<T>): T {
    const desc = this.descriptors.get(cls.name);
    if (!desc) throw new Error(`Component ${cls.name} not registered`);
    return desc.localImpl;
  }

  heartbeat() {
    for (const [name, desc] of this.descriptors) {
      console.log(`Heartbeat for ${name}: ${desc.localImpl.getStatus()}`);
    }
  }

  onModuleInit() {
    // Example: auto heartbeat every 5s
    setInterval(() => this.heartbeat(), 5000);
  }
}

// -------------------- 8️⃣ Example Component --------------------
@Component({ services: [UserServiceInterface] })
@ComponentImpl()
@Injectable()
export class UserComponentImpl extends Component {
  host = 'localhost';
  port = 3000;

  async startup() {
    console.log('UserComponent started');
  }
  async shutdown() {
    console.log('UserComponent stopped');
  }

  get addresses() {
    return [new ChannelAddress('rest', `http://${this.host}:${this.port}`)];
  }
  getStatus() {
    return 'healthy';
  }

  async createUser(name: string) {
    console.log('User created', name);
  }
  async deleteUser(id: string) {
    console.log('User deleted', id);
  }
}

// -------------------- 9️⃣ Example Service Interface --------------------
export abstract class UserServiceInterface extends Service {
  abstract createUser(name: string): Promise<void>;
  abstract deleteUser(id: string): Promise<void>;
}

// -------------------- 10️⃣ Example Client Service --------------------
@Injectable()
export class ClientService {
  @InjectService(UserServiceInterface)
  private readonly userSvc!: UserServiceInterface;

  async run() {
    await this.userSvc.createUser('Alice');
    await this.userSvc.deleteUser('123');
  }
}

// -------------------- 11️⃣ AppModule --------------------
@Module({
  providers: [
    ChannelFactory,
    LocalChannel,
    HttpChannel,
    ComponentRegistry,
    UserComponentImpl,
    ClientService,
  ],
  exports: [ComponentRegistry, ClientService],
})
export class AppModule {
  constructor(
    private readonly registry: ComponentRegistry,
    private readonly userComp: UserComponentImpl,
  ) {
    this.registry.registerComponent(userComp);
  }
}
