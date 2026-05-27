import { object, string, number, optional, array } from '@svx/common';
import type { InferObject } from '@svx/common';

export const SmallString = string().max(100);

export const AddressEntitySchema = object({
  id:   optional(number()),
  city: SmallString,
}, 'AddressEntity');

export const UserEntitySchema = object({
  id:        optional(number()),
  name:      SmallString,
  addresses: array(AddressEntitySchema),
}, 'UserEntity');

export type UserEntityType    = InferObject<typeof UserEntitySchema>
export type AddressEntityType = InferObject<typeof AddressEntitySchema>
