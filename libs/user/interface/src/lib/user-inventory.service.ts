import { UserDto } from './user.dto';
import { DeclareService, Service } from '@svx/service-common';

@DeclareService()
export abstract class UserInventoryService extends Service {
  abstract findAll(): Promise<UserDto[]>;
  abstract findOne(id: number): Promise<UserDto>;
  abstract create(dto: UserDto): Promise<UserDto>;
  abstract update(dto: UserDto): Promise<UserDto>;
  abstract delete(id: number): Promise<void>;
}
