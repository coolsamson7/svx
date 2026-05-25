import { Module } from '@nestjs/common'
import { AdviceAspect, Aspect, AspectInfo, AspectManager } from '@svx/di'
import { TypeDescriptor } from '@svx/common'
import { UserLoggingAspect } from './user-logging.aspect'
import { SchemaValidationAspect } from './schema-validation.aspect'

// ─── instance registry ────────────────────────────────────────────────────────
// Populated as NestJS creates every provider and controller.
// Acts as the DI environment so AOP code never depends on NestJS.

const _instanceMap = new Map<Function, unknown>()

const _env = {
  supports: (cls: Function): boolean => _instanceMap.has(cls),
  get: <T>(cls: Function): T => _instanceMap.get(cls) as T,
}

// No caching: aspect availability grows as instances register, and real weaving
// is deferred to first method call anyway (see _installLazyWeave below).
const _processor: any = {
  environment: _env,
  getAspectInfo(_ctor: any, compute: () => AspectInfo): AspectInfo {
    return compute()
  },
  getAspect(aspect: Aspect): Aspect {
    if (aspect instanceof AdviceAspect) {
      const inst = _env.get<any>((aspect as AdviceAspect).adviceInstance)
      if (inst) return (aspect as AdviceAspect).withInstance(inst)
    }
    return aspect
  },
}

// ─── targeting ────────────────────────────────────────────────────────────────
// Aspect decorators run at class-definition time so both sets are stable when
// this module file is first loaded.

const _targets    = AspectManager.targetClasses()
const _decorators = AspectManager.targetDecorators()

function _isTargeted(ctor: Function): boolean {
  if (ctor === Object || !ctor.prototype) return false

  // explicit .of(SomeClass) targets
  for (const t of _targets) {
    let c: any = ctor
    while (c) { if (c === t) return true; c = Object.getPrototypeOf(c) }
  }

  // .classDecoratedWith(SomeDecorator) targets
  if (_decorators.size > 0) {
    const td = TypeDescriptor.forType(ctor)
    for (const dec of _decorators) {
      if (td.hasDecorator(dec)) return true
    }
  }

  return false
}

// ─── lazy weave ───────────────────────────────────────────────────────────────
// Real weaving is deferred to the first method call on each instance.
// By then all providers are in _instanceMap (the app is fully started before
// the first request arrives), so aspect instances are guaranteed to be present.

function _installLazyWeave(instance: any, ctor: Function): void {
  let weaved = false

  const ensureWeaved = () => {
    if (weaved) return
    weaved = true
    AspectManager.wrapMethods(_processor, ctor, instance)
  }

  let proto = ctor.prototype
  while (proto && proto !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue
      const desc = Object.getOwnPropertyDescriptor(proto, key)
      if (!desc || typeof desc.value !== 'function') continue
      const original = desc.value

      const lazyWrapper = function (this: any, ...args: any[]) {
        ensureWeaved()
        const current = instance[key]
        if (current === lazyWrapper) {
          // no aspects matched this method — replace with original and call it
          instance[key] = original.bind(instance)
          return original.apply(instance, args)
        }
        return current(...args)
      }
      instance[key] = lazyWrapper
    }
    proto = Object.getPrototypeOf(proto)
  }
}

// ─── NestJS bridge: patch Injector.prototype.instantiateClass ─────────────────
// instantiateClass is the single point where NestJS constructs every provider
// and controller instance. Patching here means both HTTP-routed controllers and
// locally-injected services (e.g. message subscribers) get weaved identically,
// without any dependency on DiscoveryService or onModuleInit timing.

import { Injector } from '@nestjs/core/injector/injector'
const _origInstantiate: (...args: any[]) => Promise<any> = Injector.prototype.instantiateClass

;(Injector.prototype as any).instantiateClass = async function (...args: any[]) {
  const instance = await _origInstantiate.apply(this, args)
  if (!instance || typeof instance !== 'object') return instance

  const ctor = instance.constructor as Function
  _instanceMap.set(ctor, instance)

  if (_isTargeted(ctor)) _installLazyWeave(instance, ctor)

  return instance
}

// ─── module ───────────────────────────────────────────────────────────────────
@Module({
  providers: [UserLoggingAspect, SchemaValidationAspect],
})
export class NestAopModule {}
