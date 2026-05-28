import { Injectable } from '@nestjs/common'
import { around, Invocation, methods } from '@svx/di'
import { TypeDescriptor } from '@svx/common'
import { AuthorizationManager, Public } from '@svx/security'
import { DeclareService } from '@svx/service-common'

@Injectable()
export class AuthorizationAspect {
  constructor(private readonly authManager: AuthorizationManager) {}

  @around(methods().classDecoratedWith(DeclareService))
  async withAuthorization(invocation: Invocation): Promise<any> {
    const ctor   = (invocation.target as any).constructor
    const method = (invocation.method() as any).name ?? ''

    if (!TypeDescriptor.forType(ctor).getMethod(method)?.hasDecorator(Public))
      this.authManager.authorize(invocation)

    return invocation.proceed()
  }
}
