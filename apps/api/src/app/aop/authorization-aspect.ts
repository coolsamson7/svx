import { Injectable } from '@nestjs/common'
import { around, Invocation, methods } from '@svx/di'
import { TypeDescriptor } from '@svx/common'
import { AuthorizationManager, Public } from '@svx/security'
import { UserInventoryServiceController } from '@svx/user-core'

@Injectable()
export class AuthorizationAspect {
  constructor(private readonly authManager: AuthorizationManager) {}

  @around(methods().of(UserInventoryServiceController)) //TODO .classDecoratedWith(DeclareService as any)
  async withAuthorization(invocation: Invocation): Promise<any> {
    const ctor   = (invocation.target as any).constructor
    const method = (invocation.method() as any).name ?? ''

    if (!TypeDescriptor.forType(ctor).getMethod(method)?.hasDecorator(Public as any))
      this.authManager.authorize(invocation)

    return invocation.proceed()
  }
}
