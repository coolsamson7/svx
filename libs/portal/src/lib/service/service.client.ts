/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * service-client.ts — CLIENT only (Svelte)
 *
 * Reads from ServiceRegistry (shared).
 * Uses own DI (@injectable).
 * Always remote — no local binding, no discovery, no address resolution.
 */

import { injectable }    from '../di/'
import { ProxyBuilder } from './proxy-builder'
import {
  AbstractType,
  Service,
  ServiceDescriptor,
  ServiceRegistry,
} from './service.shared'


/* =========================================================
 * ServiceClient
 * ========================================================= */

@injectable()
export class ServiceClient {
  // instance data

  private proxies     = new Map<AbstractType<Service>, Service>()
  private descriptors = new Map<string, ServiceDescriptor>()

  private serviceRegistry = new ServiceRegistry()

  // constructor

  constructor(private readonly channel: RestChannel) {
    // pre-build descriptors from shared registry
    for (const decl of ServiceRegistry.serviceDeclarations)
      this.descriptors.set(decl.name, new ServiceDescriptor(decl.name, decl.type))
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
