import { Field, ArrayOf } from '@svx/common';

import { AddressDto } from './address.dto';

export class UserDto {
  @Field() id?: number;
  @Field() name!: string;
  @ArrayOf(AddressDto) @Field() addresses!: AddressDto[];
}
