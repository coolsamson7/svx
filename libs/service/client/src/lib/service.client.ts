/* eslint-disable @typescript-eslint/no-explicit-any */
import { injectable }    from '@svx/di'
import { AxiosRestChannel } from './axios.channel'

import {
  AbstractType,
  Channel,
  Component,
  ComponentDescriptor,
  Service,
  ServiceRegistry,
  ProxyBuilder
} from '@svx/service-common'

export abstract class ComponentLocator {
  abstract locate(component: ComponentDescriptor<Component>): string
}

@injectable()
export class ServiceClient {
  // instance data

  private proxies = new Map<AbstractType<Service>, Service>()
  private channels = new Map<string, Channel>()

  serviceRegistry = new ServiceRegistry()

  // constructor

  constructor(private componentLocator: ComponentLocator) {
  }

  // private

  private getChannel(component: ComponentDescriptor<Component>): Channel {
    const url = this.componentLocator.locate(component)
    let channel = this.channels.get(url)
    if (!channel) {
      channel = new AxiosRestChannel()
      channel.url = url

      this.channels.set(url, channel)
    }

    return channel
  }

  // public

  getService<T extends Service>(type: AbstractType<T>): T {
    let proxy = this.proxies.get(type)
    if (!proxy) {
      const descriptor = this.serviceRegistry.findServiceDescriptor(type)

      proxy = new ProxyBuilder<T>(type)
        .bind((name, ...args) => this.getChannel(descriptor.componentDescriptor).call(descriptor, name, ...args))
        .build()

      this.proxies.set(type, proxy)
    }

    return proxy as T
  }
}
