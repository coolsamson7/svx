
import { Field } from "@svx/common";

import { AddressDto } from "./address.dto";

export class UserDto {
  @Field() id?: number;
  @Field() name!: string;
  @Field() addresses!: AddressDto[];
}
