import { Field } from "@svx/common";

export class AddressDto {
  @Field() id?: number;
  @Field() city!: string;
}
