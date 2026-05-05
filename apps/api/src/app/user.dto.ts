import { field } from "./field.decorator";

import { AddressDto } from "./address.dto";

export class UserDto {
  @field()
  id?: number;

  @field()
  name!: string;

  @field()
  addresses!: AddressDto[];
}
