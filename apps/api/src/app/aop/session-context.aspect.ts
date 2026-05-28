import { Injectable, UnauthorizedException }  from '@nestjs/common'
import { around, Invocation, methods }         from '@svx/di'
import { SessionContext, Public }              from '@svx/security'
import { DeclareService } from '@svx/service-common'

@Injectable()
export class SessionContextAspect {
  constructor(private readonly sessionContext: SessionContext) {}

  @around(methods().classDecoratedWith(DeclareService).order(0))
  async withSession(invocation: Invocation): Promise<any> {
    if (Public.isOn(invocation.method() as Function)) {
      return invocation.proceed()
    }

    // If a session is already present (subscriber set it via run(), or token already
    // cached from a prior call), skip JWT work entirely.
    if (this.sessionContext.current() === null) {
      await this.sessionContext.establish()

      if (this.sessionContext.current() === null) throw new UnauthorizedException('No active session')
    }

    return invocation.proceed()
  }
}
