
import {
  AbstractInstanceProvider,
  Environment,
  Providers
} from '../di'
import { ServiceClient } from './service.client'

import {
  Service,
  AbstractType,
  ServiceRegistry,
} from './service.shared'


export class ServiceInstanceProvider<T extends Service> extends AbstractInstanceProvider<T> {
  // static

  static registerServiceProviders(): void {
    for (const declaration of ServiceRegistry.serviceDeclarations) {
        Providers.register(new ServiceInstanceProvider(declaration.type))
    }
  }

  // constructor

  constructor(private readonly serviceType: AbstractType<T>) {
    super()
  }

  // implement

  override getType()  { return this.serviceType }
  override isEager()  { return false }            // created on first injection
  override getScope() { return 'singleton' }      // proxy is stateless — reuse it

  override getDependencies(): [any[], number] {
    return [[ServiceClient], 1]                   // depends only on ServiceClient
  }

  override create(environment: Environment, client: ServiceClient): T {
    return client.getService(this.serviceType)
  }

  override report(): string {
    return `ServiceProxy(${this.serviceType.name})`
  }
}
