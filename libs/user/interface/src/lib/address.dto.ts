import { Implements, Reflectable } from '@svx/common';
import { AddressSchema, type Address } from './address.schema';

@Reflectable()
@Implements(AddressSchema)
export class AddressDto implements Address {
  id: number | undefined;
  city!: string;
}
