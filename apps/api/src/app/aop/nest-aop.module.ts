import { Injectable, Module, OnModuleInit } from '@nestjs/common'
import { DiscoveryModule, DiscoveryService, ModuleRef } from '@nestjs/core'
import { AdviceAspect, Aspect, AspectInfo, AspectManager } from '@svx/di'
import { UserLoggingAspect } from './user-logging.aspect'

// Duck-typed bridge: replaces Environment.supports() / .get() with NestJS ModuleRef
class NestEnvironmentAdapter {
  constructor(private moduleRef: ModuleRef) {}

  supports(cls: any): boolean {
    try {
      this.moduleRef.get(cls, { strict: false })
      return true
    } catch {
      return false
    }
  }

  get<T>(cls: any): T {
    return this.moduleRef.get<T>(cls, { strict: false })
  }
}

// Mirrors the shape of AdviceProcessor without extending it (avoids @injectable side-effects)
class NestAdviceProcessor {
  private info = new Map<any, AspectInfo>()
  private resolvedAspects = new Map<Aspect, Aspect>()
  environment: NestEnvironmentAdapter

  constructor(moduleRef: ModuleRef) {
    this.environment = new NestEnvironmentAdapter(moduleRef)
  }

  getAspectInfo(ctor: any, compute: () => AspectInfo): AspectInfo {
    let info = this.info.get(ctor)
    if (!info) this.info.set(ctor, info = compute())
    return info
  }

  getAspect(aspect: Aspect): Aspect {
    let result = this.resolvedAspects.get(aspect)
    if (!result) {
      if (aspect instanceof AdviceAspect) {
        const instance = this.environment.get(aspect.adviceInstance)
        result = aspect.withInstance(instance)
      } else {
        result = aspect
      }
      this.resolvedAspects.set(aspect, result)
    }
    return result
  }
}

@Injectable()
export class AopWeaver implements OnModuleInit {
  constructor(
    private discovery: DiscoveryService,
    private moduleRef: ModuleRef,
  ) {}

  onModuleInit() {
    const processor = new NestAdviceProcessor(this.moduleRef)

    const wrappers = [
      ...this.discovery.getControllers(),
      ...this.discovery.getProviders(),
    ]

    for (const wrapper of wrappers) {
      const { instance } = wrapper
      if (!instance || typeof instance !== 'object') continue
      // cast: NestAdviceProcessor matches the runtime shape AdviceProcessor expects
      AspectManager.wrapMethods(processor as any, instance.constructor, instance)
    }
  }
}

@Module({
  imports: [DiscoveryModule],
  providers: [UserLoggingAspect, AopWeaver],
})
export class NestAopModule {}
