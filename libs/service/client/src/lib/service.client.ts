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

export interface TokenProvider {
  getToken(): Promise<string | undefined>
}

@injectable()
export class ServiceClient {
  // instance data

  private proxies      = new Map<AbstractType<Service>, Service>()
  private channels     = new Map<string, Channel>()
  private tokenProvider?: TokenProvider

  serviceRegistry = new ServiceRegistry()

  // constructor

  constructor(private componentLocator: ComponentLocator) {
  }

  // public

  setTokenProvider(provider: TokenProvider): void {
    this.tokenProvider = provider
    for (const channel of this.channels.values()) {
      if (channel instanceof AxiosRestChannel)
        (channel as AxiosRestChannel).setTokenProvider(provider)
    }
  }

  // private

  private getChannel(component: ComponentDescriptor<Component>): Channel {
    const url = this.componentLocator.locate(component)
    let channel = this.channels.get(url)
    if (!channel) {
      const axiosChannel = new AxiosRestChannel()
      axiosChannel.url = url
      if (this.tokenProvider)
        axiosChannel.setTokenProvider(this.tokenProvider)
      this.channels.set(url, axiosChannel)
      channel = axiosChannel
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
