import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { Type, ValidationError } from '@svx/common';

@Injectable()
export class SchemaValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: Type<any, T>) {}

  transform(value: unknown): T {
    try {
      this.schema.validate(value as T);
      return value as T;
    } catch (e) {
      if (e instanceof ValidationError)
        throw new BadRequestException({ message: 'Validation failed', errors: e.violations });
      throw e;
    }
  }
}
