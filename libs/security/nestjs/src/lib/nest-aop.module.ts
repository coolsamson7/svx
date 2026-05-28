import { Module, DynamicModule } from '@nestjs/common'
import { AdviceAspect, Aspect, AspectInfo, AspectManager } from '@svx/di'
import { TypeDescriptor } from '@svx/common'
import { Injector } from '@nestjs/core/injector/injector'

// ─── instance registry ────────────────────────────────────────────────────────

const _instanceMap = new Map<Function, unknown>()

const _env = {
  supports: (cls: Function): boolean => _instanceMap.has(cls),
  get: <T>(cls: Function): T => _instanceMap.get(cls) as T,
}

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
// Read from AspectManager lazily so aspects registered after this module is
// imported (i.e. the app's own aspect files) are always visible.

function _isTargeted(ctor: Function): boolean {
  if (ctor === Object || !ctor.prototype) return false

  for (const t of AspectManager.targetClasses()) {
    let c: any = ctor
    while (c) { if (c === t) return true; c = Object.getPrototypeOf(c) }
  }

  const decorators = AspectManager.targetDecorators()
  if (decorators.size > 0) {
    const td = TypeDescriptor.forType(ctor)
    for (const dec of decorators) {
      if (td.hasDecorator(dec)) return true
    }
  }

  return false
}

// ─── lazy weave ───────────────────────────────────────────────────────────────

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

// ─── NestJS bridge ────────────────────────────────────────────────────────────

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

@Module({})
export class NestAopModule {
  static forRoot(): DynamicModule {
    return { module: NestAopModule }
  }
}
