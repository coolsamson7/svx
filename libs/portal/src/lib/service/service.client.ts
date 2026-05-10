/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * service-client.ts — CLIENT only (Svelte)
 *
 * Reads from ServiceRegistry (shared).
 * Uses own DI (@injectable).
 * Always remote — no local binding, no discovery, no address resolution.
 */

import { injectable }    from '../di/'
import { TypeDescriptor } from '../reflection'
import {
  AbstractType,
  Service,
  ServiceDescriptor,
  ServiceRegistry,
} from './service.shared'
import { RestChannel } from './rest-channel.client'

/* =========================================================
 * ServiceClient
 * ========================================================= */

@injectable()
export class ServiceClient {
  private proxies     = new Map<AbstractType<Service>, Service>()
  private descriptors = new Map<string, ServiceDescriptor>()

  constructor(private readonly channel: RestChannel) {
    // pre-build descriptors from shared registry
    for (const decl of ServiceRegistry.serviceDeclarations)
      this.descriptors.set(decl.name, new ServiceDescriptor(decl.name, decl.type))
  }

  getService<T extends Service>(type: AbstractType<T>): T {
    const cached = this.proxies.get(type)
    if (cached) return cached as T

    // find descriptor by type — walk prototype chain like server does
    const descriptor = this.findDescriptor(type)
    const methods    = TypeDescriptor.forType(type as any).getMethods()
    const proxy      = Object.create((type as any).prototype)

    // always remote — direct binding, no lazy stubs
    for (const method of methods) {
      const name = method.name
      proxy[name] = (...args: any[]) => this.channel.call(descriptor, name, ...args)
    }

    this.proxies.set(type, proxy)
    return proxy as T
  }

  private findDescriptor(type: AbstractType<Service>): ServiceDescriptor {
    let current: any = type

    while (current && current !== Function.prototype && current !== Object) {
      for (const descriptor of this.descriptors.values()) {
        if (descriptor.type === current)
          return descriptor
      }
      current = Object.getPrototypeOf(current)
    }

    throw new Error(`No service descriptor for ${(type as any).name}`)
  }
}
