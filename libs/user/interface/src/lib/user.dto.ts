import { Implements, Reflectable } from '@svx/common';
import { UserSchema, type User } from './user.schema';
import { AddressDto } from './address.dto';

@Reflectable()
@Implements(UserSchema)
export class UserDto implements User {
  /** Auto-assigned user ID. */
  id: number | undefined;
  /** Full display name of the user. */
  name!: string;
  /** Contact email address. */
  email!: string;
  /** Age in years (0–150). */
  age: number | undefined;
  /** Internal quality score, exclusive range (0–100). */
  score: number | undefined;
  /** Postal addresses associated with the user. */
  addresses!: AddressDto[];
}
