import type { User, CreateUser } from './user.schema';
import { DeclareService, Service } from '@svx/service-common';

@DeclareService()
export abstract class UserInventoryService extends Service {
  /** Returns all users in the inventory. */
  abstract findAll(): Promise<User[]>;
  /** Finds a single user by their numeric ID. */
  abstract findOne(id: number): Promise<User>;
  /** Creates a new user from the supplied data. */
  abstract create(dto: CreateUser): Promise<User>;
  /** Updates an existing user's data. */
  abstract update(dto: User): Promise<User>;
  /** Permanently removes a user by ID. */
  abstract delete(id: number): Promise<void>;
}
