import { Implements, Reflectable } from '@svx/common';
import { AddressSchema, type Address } from './address.schema';

@Reflectable()
@Implements(AddressSchema)
export class AddressDto implements Address {
  /** Unique identifier for the address. */
  id: number | undefined;
  /** City name (max 100 characters). */
  city!: string;
}
