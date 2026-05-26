import { object, string, number, optional, array } from '@svx/common';
import type { InferObject } from '@svx/common';
import { AddressSchema } from './address.schema';

export type { Address } from './address.schema';

export const UserSchema = object({
  id:        optional(number()),
  name:      string().min(1).max(100),
  email:     string().email().max(200),
  age:       optional(number().min(0).max(150)),
  score:     optional(number().greaterThan(0).lessThan(100)),
  addresses: array(AddressSchema).min(1),
}, "User");

export type User = InferObject<typeof UserSchema>;

export const CreateUserSchema = object({
  name:      string().min(1).max(100),
  email:     string().email().max(200),
  age:       optional(number().min(0).max(150)),
  addresses: array(AddressSchema).min(1),
}, "CreateUser");

export type CreateUser = InferObject<typeof CreateUserSchema>;
