import { Component, DeclareComponent, DeclareService, Service } from "@svx/service-common";
import { Field, Method } from "@svx/common"

export class AddressDto {
   @Field() id?: number;
   @Field() city!: string;
 }

 export function NYI() : never {
  throw new Error("NYI")
 }

export class UserDto {
  @Field() id?: number;
  @Field() name!: string;
  @Field() addresses!: AddressDto[];
}

@DeclareService()
export abstract class UserInventoryService extends Service {
   findAll(): Promise<UserDto[]> { return NYI()}
   findOne(id: number): Promise<UserDto> { return NYI()}
   create(dto: UserDto): Promise<UserDto> { return NYI()}
   update(dto: UserDto): Promise<UserDto> { return NYI()}
   delete(id: number): Promise<void> { return NYI()}
}

@DeclareComponent({ name: "user-component", services: [UserInventoryService] })
export abstract class UserInventoryComponent extends Component {}
