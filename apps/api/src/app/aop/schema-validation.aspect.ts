import { Injectable } from '@nestjs/common'
import { Invocation } from '@svx/di'

@Injectable()
export class SchemaValidationAspect {
  async validate(invocation: Invocation): Promise<any> {
    return invocation.proceed()
  }
}
