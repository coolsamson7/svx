import { field } from "./field.decorator";

export class AddressDto {
  @field() id?: number;
  @field() city!: string;
}
