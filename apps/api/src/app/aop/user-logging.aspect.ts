import { Injectable } from '@nestjs/common'
import { around, Invocation, methods } from '@svx/di'
import { DeclareService } from '@svx/service-common'

@Injectable()
export class UserLoggingAspect {
  @around(methods().classDecoratedWith(DeclareService))
  async logExecution(invocation: Invocation): Promise<any> {
    const methodName = invocation.method().name
    
    console.log(`[AOP] → ${methodName}`, invocation.args)

    const start = Date.now()
    try {
      const result = await invocation.proceed()
      console.log(`[AOP] ← ${methodName} (${Date.now() - start}ms)`, result)
      return result
    } 
    catch (err) {
      console.error(`[AOP] ✗ ${methodName} (${Date.now() - start}ms)`, err)
      throw err
    }
  }
}
