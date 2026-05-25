import { Implements, Reflectable } from '@svx/common';
import { UserSchema, type User } from './user.schema';
import { AddressDto } from './address.dto';

@Reflectable()
@Implements(UserSchema)
export class UserDto implements User {
  id: number | undefined;
  name!: string;
  email!: string;
  age: number | undefined;
  score: number | undefined;
  addresses!: AddressDto[];
}
