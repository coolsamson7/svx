/* eslint-disable @typescript-eslint/no-explicit-any */
import { injectable }    from '../di/'
import { ProxyBuilder } from './proxy-builder'
import {
  AbstractType,
  Service,
  ServiceRegistry,
} from './service.shared'

export abstract class ComponentLocator {
  abstract locate(component: ComponentDescriptor<Component>): string
}

@injectable()
export class StaticComponentLocator extends ComponentLocator {
  // implement

  locate(component: ComponentDescriptor<Component>): string {
    return "http://localhost:3000"
  }
}

@injectable()
export class ServiceClient {
  // instance data

  private proxies     = new Map<AbstractType<Service>, Service>()

  serviceRegistry = new ServiceRegistry()

  // constructor

  constructor(private readonly channel: RestChannel, private componentLocator: ComponentLocator) {
  }

  // public

  getService<T extends Service>(type: AbstractType<T>): T {
    let proxy = this.proxies.get(type)
    if (!proxy) {
      const descriptor = this.serviceRegistry.findServiceDescriptor(type)

      proxy = new ProxyBuilder<T>(type)
        .bind((name, ...args) => this.channel.call(descriptor, name, ...args))
        .build()

      this.proxies.set(type, proxy)
    }

    return proxy as T
  }
}
