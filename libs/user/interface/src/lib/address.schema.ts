import { object, string, number, optional } from '@svx/common';
import type { InferObject } from '@svx/common';

export const AddressSchema = object({
  /** The unique identifier for the address */
  id:   optional(number()),
  city: string().description("The city of the address").length(100),
}, "Address");

export type Address = InferObject<typeof AddressSchema>;
