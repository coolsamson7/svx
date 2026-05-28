import { Injectable } from '@nestjs/common'
import { around, Invocation, methods } from '@svx/di'
import { AuthorizationManager } from '@svx/security-nestjs'
import { Public } from '@svx/security'
import { DeclareService } from '@svx/service-common'

@Injectable()
export class AuthorizationAspect {
  constructor(private readonly authManager: AuthorizationManager) {}

  @around(methods().classDecoratedWith(DeclareService).order(1))
  async withAuthorization(invocation: Invocation): Promise<any> {
    if (!Public.isOn(invocation.method() as Function))
      this.authManager.authorize(invocation)

    return invocation.proceed()
  }
}
