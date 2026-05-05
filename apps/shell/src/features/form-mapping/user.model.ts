import { number, object, string } from "@svx/portal";

export interface Address {
  city: string;
  street: string;
}

export interface User {
  id: number;
  name: string;
  address?: Address
}

export const UserSchema = object({
  id: number(),
  name: string(),
  address: object({
    city: string(),
    street: string()
  })
})
