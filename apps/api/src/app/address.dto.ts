import { Field } from "@svx/portal";

export class AddressDto {
  @Field() id?: number;
  @Field() city!: string;
}
