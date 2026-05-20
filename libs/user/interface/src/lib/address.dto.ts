import { Reflectable } from '@svx/common';

@Reflectable()
export class AddressDto {
  id?: number;
  city!: string;
}
