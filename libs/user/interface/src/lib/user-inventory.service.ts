import { UserDto } from './user.dto';

import { DeclareService, Service, ABSTRACT } from '@svx/service-common';

@DeclareService()
export abstract class UserInventoryService extends Service {
  findAll(): Promise<UserDto[]> {return ABSTRACT();}
  findOne(id: number): Promise<UserDto> {return ABSTRACT();}
  create(dto: UserDto): Promise<UserDto> {return ABSTRACT();}
  update(dto: UserDto): Promise<UserDto> {return ABSTRACT();}
  delete(id: number): Promise<void> {return ABSTRACT();}
}
