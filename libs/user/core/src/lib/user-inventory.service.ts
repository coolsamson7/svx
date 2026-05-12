import { Controller, Injectable, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from "@nestjs/common";
import { Repository } from "typeorm";
import { UserEntity } from "./entity/user.entity";
import { UserDto, AddressDto, UserInventoryService } from '@svx/user-interface';
import { Transactional } from "typeorm-transactional";

import { InjectRepository } from "@nestjs/typeorm";
import { Mapper, mapping, RelationSynchronizer, syncRelation, ApplyContext } from "@svx/core";

import { Implementation } from "@svx/service-nestjs";

import { AddressEntity } from "./entity/address.entity";

class AddressSynchronizer extends RelationSynchronizer<AddressDto, AddressEntity, number> {
  protected provide(source: AddressDto, ctx: ApplyContext): AddressEntity {
    return ctx.mapper.map<AddressDto,AddressEntity>(source, {direction: "reverse", sourceType: AddressDto, target: new AddressEntity()})
  }

  protected update(target: AddressEntity, source: AddressDto, ctx: ApplyContext): void {
    ctx.mapper.map<AddressDto,AddressEntity>(source, {direction: "reverse",  sourceType: AddressDto, target: target})
  }
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
  @Transactional()
  async findAll(): Promise<UserDto[]> {
    const entities = await this.repo.find({ relations: ["addresses"] });

    return this.mapper.mapList(entities);
  }

  @Get(':id')
  @Transactional()
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<UserDto> {
    const entity = await this.repo.findOneOrFail({
      where: { id },
      relations: ["addresses"],
    });

    return this.mapper.map<UserEntity,UserDto>(entity);
  }

  @Post()
  @Transactional()
  async create(@Body() dto: UserDto): Promise<UserDto> {
    const entity = this.mapper.map<UserDto, UserEntity>(dto, { direction: "reverse"});

    const saved = await this.repo.save(entity);

    return this.mapper.map<UserEntity, UserDto>(saved);
  }

  @Put()
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
  @Transactional()
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
