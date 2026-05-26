import { Reflectable, Implements } from '@svx/common';
import { CreateUserSchema, type CreateUser } from './user.schema';
import { AddressDto } from './address.dto';

@Reflectable()
@Implements(CreateUserSchema)
export class CreateUserDto implements CreateUser {
  /** Full display name of the user. */
  name!: string;
  /** Contact email address. */
  email!: string;
  /** Age in years (0–150). */
  age: number | undefined;
  /** Postal addresses (at least one required). */
  addresses!: AddressDto[];
}
