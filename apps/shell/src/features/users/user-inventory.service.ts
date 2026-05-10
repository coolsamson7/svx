import { Field, Component, DeclareComponent, DeclareService, Service } from "@svx/portal";

export class AddressDto {
   @Field() id?: number;
   @Field() city!: string;
 }
 
export class UserDto {
  @Field() id?: number;
  @Field() name!: string;
  @Field() addresses!: AddressDto[];
}

@DeclareService()
export abstract class UserInventoryService extends Service {
   abstract findAll(): Promise<UserDto[]>
   abstract findOne(id: number): Promise<UserDto>
   abstract create(dto: UserDto): Promise<UserDto>
   abstract update(dto: UserDto): Promise<UserDto>
   abstract delete(id: number): Promise<void>
}

@DeclareComponent({ name: "user-component", services: [UserInventoryService] })
export abstract class UserInventoryComponent extends Component {}
