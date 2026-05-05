import { Controller, Get, Post, Put, Delete, Body, Param } from "@nestjs/common";
import { UserInventoryService } from "./user-inventory.service";
import { UserDto } from "./user.dto";

@Controller("users")
export class UserInventoryController {
  constructor(private service: UserInventoryService) {}

  @Get()
  findAll(): Promise<UserDto[]> {
    return this.service.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: number): Promise<UserDto> {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: UserDto): Promise<UserDto> {
    return this.service.create(dto);
  }

  @Post()
  update( @Body() dto: UserDto): Promise<UserDto> {
    return this.service.update(dto);
  }

  @Delete(":id")
  delete(@Param("id") id: number) {
    return this.service.delete(id);
  }
}
