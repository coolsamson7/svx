import { Controller, Injectable, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from "@nestjs/common";
import { Permissions } from "@svx/auth-nestjs";
import { Repository } from "typeorm";
import { UserEntity } from "./user.entity";
import { UserDto } from "./user.dto";
import { Transactional } from "typeorm-transactional";

import { InjectRepository } from "@nestjs/typeorm";
import { Mapper, mapping, RelationSynchronizer, syncRelation, ApplyContext } from "@svx/core";

import { DeclareService, Service } from "@svx/service-common";
import { Implementation } from "@svx/service-nestjs";
import { AddressDto } from "./address.dto";
import { AddressEntity } from "./address.entity";

class AddressSynchronizer extends RelationSynchronizer<AddressDto, AddressEntity, number> {
  protected provide(source: AddressDto, ctx: ApplyContext): AddressEntity {
    return ctx.mapper.map<AddressDto,AddressEntity>(source, {direction: "reverse", sourceType: AddressDto, target: new AddressEntity()})
  }

  protected update(target: AddressEntity, source: AddressDto, ctx: ApplyContext): void {
    ctx.mapper.map<AddressDto,AddressEntity>(source, {direction: "reverse",  sourceType: AddressDto, target: target})
  }
}

@DeclareService()
export abstract class UserInventoryService extends Service {
   abstract findAll(): Promise<UserDto[]>
   abstract findOne(id: number): Promise<UserDto>
   abstract create(dto: UserDto): Promise<UserDto>
   abstract update(dto: UserDto): Promise<UserDto>
   abstract delete(id: number): Promise<void>
}

@Injectable()
@Implementation()
@Controller("users")
export class UserInventoryServiceController extends UserInventoryService {
  // instance data

  mapper : Mapper

  // constructor

  constructor(@InjectRepository(UserEntity) private repo: Repository<UserEntity>) {
    super();
    const synchronizer = new AddressSynchronizer(s => s.id!, t => t.id!);

    this.mapper = new Mapper(
      // user

      mapping(UserEntity, UserDto, map => {
        map.from("id").to("id");
        map.from("name").to("name");
        map.from("addresses").to("addresses").apply({
          target: syncRelation(synchronizer)
        });
      }),

      // address

      mapping(AddressEntity, AddressDto, map => {
         map.matching()
      }),
    ).setOptions({autoDeep: true});
  }

  // implement

  @Get()
  @Permissions('users:read')
  @Transactional()
  async findAll(): Promise<UserDto[]> {
    const entities = await this.repo.find({ relations: ["addresses"] });

    return this.mapper.mapList(entities);
  }

  @Get(':id')
  @Permissions('users:read')
  @Transactional()
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<UserDto> {
    const entity = await this.repo.findOneOrFail({
      where: { id },
      relations: ["addresses"],
    });

    return this.mapper.map<UserEntity,UserDto>(entity);
  }

  @Post()
  @Permissions('users:write')
  @Transactional()
  async create(@Body() dto: UserDto): Promise<UserDto> {
    const entity = this.mapper.map<UserDto, UserEntity>(dto, { direction: "reverse"});

    const saved = await this.repo.save(entity);

    return this.mapper.map<UserEntity, UserDto>(saved);
  }

  @Put()
  @Permissions('users:write')
  @Transactional()
  async update(@Body() dto: UserDto): Promise<UserDto> {
   const entity = await this.repo.findOneOrFail({
      where: { id: dto.id! },
      relations: ["addresses"],
    });

    this.mapper.map(dto, {target: entity, direction: "reverse"});

    const saved = await this.repo.save(entity);

    return this.mapper.map(saved);
  }

  @Delete(':id')
  @Permissions('users:delete')
  @Transactional()
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
