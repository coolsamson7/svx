import { Reflectable } from '@svx/common';
import { AddressDto } from './address.dto';

@Reflectable()
export class UserDto {
  id?: number;
  name!: string;
  addresses!: AddressDto[];
}
