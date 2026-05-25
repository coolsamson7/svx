import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, UsePipes } from "@nestjs/common";
import { Repository } from "typeorm";
import { UserEntity } from "./entity/user.entity";
import { UserDto, AddressDto, UserInventoryService, CreateUserSchema, UserSchema } from '@svx/user-interface';
import type { User, CreateUser } from '@svx/user-interface';
import { Transactional } from "typeorm-transactional";

import { InjectRepository } from "@nestjs/typeorm";
import { Mapper, mapping, RelationSynchronizer, syncRelation, ApplyContext } from "@svx/core";

import { Implementation } from "@svx/service-nestjs";
import { SchemaValidationPipe } from "@svx/service-nestjs";

import { AddressEntity } from "./entity/address.entity";

class AddressSynchronizer extends RelationSynchronizer<AddressDto, AddressEntity, number> {
  protected provide(source: AddressDto, ctx: ApplyContext): AddressEntity {
    return ctx.mapper.map<AddressDto, AddressEntity>(source, { direction: "reverse", sourceType: AddressDto, target: new AddressEntity() });
  }

  protected update(target: AddressEntity, source: AddressDto, ctx: ApplyContext): void {
    ctx.mapper.map<AddressDto, AddressEntity>(source, { direction: "reverse", sourceType: AddressDto, target });
  }
}

@Implementation()
@Controller("users")
export class UserInventoryServiceController extends UserInventoryService {
  mapper: Mapper;

  constructor(@InjectRepository(UserEntity) private repo: Repository<UserEntity>) {
    super();
    const synchronizer = new AddressSynchronizer(s => s.id!, t => t.id!);

    this.mapper = new Mapper(
      mapping(UserEntity, UserDto, map => {
        map.from("id").to("id");
        map.from("name").to("name");
        map.from("addresses").to("addresses").apply({ target: syncRelation(synchronizer) });
      }),
      mapping(AddressEntity, AddressDto, map => { map.matching(); }),
    ).setOptions({ autoDeep: true });
  }

  @Get("all")
  @Transactional()
  async findAll(): Promise<UserDto[]> {
    const entities = await this.repo.find({ relations: ["addresses"] });
    return this.mapper.mapList(entities);
  }

  @Get('find/:id')
  @Transactional()
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<UserDto> {
    const entity = await this.repo.findOneOrFail({ where: { id }, relations: ["addresses"] });
    return this.mapper.map<UserEntity, UserDto>(entity);
  }

  @Post("create")
  @UsePipes(new SchemaValidationPipe(CreateUserSchema))
  @Transactional()
  async create(@Body() dto: CreateUser): Promise<UserDto> {
    const entity = this.mapper.map<UserDto, UserEntity>(dto as UserDto, { direction: "reverse" });
    const saved = await this.repo.save(entity);
    return this.mapper.map<UserEntity, UserDto>(saved);
  }

  @Put("update")
  @UsePipes(new SchemaValidationPipe(UserSchema))
  @Transactional()
  async update(@Body() dto: User): Promise<UserDto> {
    const entity = await this.repo.findOneOrFail({ where: { id: dto.id! }, relations: ["addresses"] });
    this.mapper.map(dto as UserDto, { target: entity, direction: "reverse" });
    const saved = await this.repo.save(entity);
    return this.mapper.map(saved);
  }

  @Delete('delete/:id')
  @Transactional()
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
