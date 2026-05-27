import { Injectable, UnauthorizedException }  from '@nestjs/common'
import { around, Invocation, methods }         from '@svx/di'
import { DeclareService }                      from '@svx/service-common'
import { ServerSessionContext, Public }        from '@svx/security'
import { TypeDescriptor }                      from '@svx/common'
import { UserInventoryServiceController } from '@svx/user-core'

@Injectable()
export class SessionContextAspect {
  constructor(private readonly sessionContext: ServerSessionContext) {}

  @around(methods().of(UserInventoryServiceController))//TODO .classDecoratedWith(DeclareService as any))
  async withSession(invocation: Invocation): Promise<any> {
    console.log("withSession aspect invoked for", invocation.method().name)
    const ctor   = (invocation.target as any).constructor
    const method = (invocation.method() as any).name ?? ''

    if (TypeDescriptor.forType(ctor).getMethod(method)?.hasDecorator(Public as any)) {
      return invocation.proceed()
    }

    // If a session is already present (subscriber set it via run(), or token already
    // cached from a prior call), skip JWT work entirely.
    if (this.sessionContext.current() === null) {
      await this.sessionContext.establish()
    }

    if (this.sessionContext.current() === null) throw new UnauthorizedException('No active session')

    return invocation.proceed()
  }
}
