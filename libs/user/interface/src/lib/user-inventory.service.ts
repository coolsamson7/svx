import type { User, CreateUser } from './user.schema';
import { DeclareService, Service } from '@svx/service-common';

@DeclareService()
export abstract class UserInventoryService extends Service {
  abstract findAll(): Promise<User[]>;
  abstract findOne(id: number): Promise<User>;
  abstract create(dto: CreateUser): Promise<User>;
  abstract update(dto: User): Promise<User>;
  abstract delete(id: number): Promise<void>;
}
