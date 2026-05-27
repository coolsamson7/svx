import { Injectable } from '@nestjs/common'
import { Invocation } from '@svx/di'
import { MethodDescriptor, TypeDescriptor } from '@svx/common'

/**
 * A single, pre-computed authorization check.
 * Instances are created once by AuthorizationFactory.computeAuthorization()
 * and cached per method. Any context they need (e.g. a session accessor) is
 * injected at construction time by the factory.
 * Throw (e.g. ForbiddenException) to deny; return normally to allow.
 */
export abstract class Authorization {
  abstract authorize(invocation: Invocation): void
}

/**
 * Inspects a MethodDescriptor and returns a pre-computed Authorization check.
 *
 * Declare `decorators` with every decorator this factory handles — the manager
 * will only call `computeAuthorization` when at least one of them is present on
 * the method, so factories never need to return null.
 *
 * Provide under AUTHORIZATION_FACTORY with multi: true. Factories with lower
 * `order` run first. Results are cached per method after the first call.
 */
export abstract class AuthorizationFactory {
  order = 0
  abstract readonly decorators: Function[]
  abstract computeAuthorization(method: MethodDescriptor): Authorization
}

/**
 * Collects AuthorizationFactory instances, lazily computes and caches the
 * list of checks per method, then runs them in order on each invocation.
 */
@Injectable()
export class AuthorizationManager {
  private readonly factories: AuthorizationFactory[]
  private readonly cache = new Map<Function, Authorization[]>()

  constructor() {
    this.factories = []
  }

  registerFactory(factory: AuthorizationFactory): void {
    this.factories.push(factory)
    this.factories.sort((a, b) => a.order - b.order)
  }

  private buildChecks(ctor: Function, methodName: string): Authorization[] {
    const descriptor = TypeDescriptor.forType(ctor as any).getMethod(methodName)
    if (!descriptor) return []
    return this.factories
      .filter(f => f.decorators.some(d => descriptor.hasDecorator(d)))
      .map(f => f.computeAuthorization(descriptor))
  }

  getChecks(invocation: Invocation): Authorization[] {
    const method = invocation.method()
    if (!this.cache.has(method)) {
      const ctor = (invocation.target as any).constructor as Function
      const name = (method as any).name as string
      this.cache.set(method, this.buildChecks(ctor, name))
    }
    return this.cache.get(method)!
  }

  authorize(invocation: Invocation): void {
    for (const check of this.getChecks(invocation))
      check.authorize(invocation)
  }
}
