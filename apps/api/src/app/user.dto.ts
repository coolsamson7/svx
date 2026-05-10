
import { Field } from "@svx/portal";

import { AddressDto } from "./address.dto";

export class UserDto {
  @Field() id?: number;
  @Field() name!: string;
  @Field() addresses!: AddressDto[];
}
