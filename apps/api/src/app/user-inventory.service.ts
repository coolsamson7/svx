import { Controller, Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { UserEntity } from "./user.entity";
import { UserDto } from "./user.dto";
import { Transactional } from "typeorm-transactional";

import { InjectRepository } from "@nestjs/typeorm";
import { Mapper, mapping, RelationSynchronizer, syncRelation, ApplyContext } from "@svx/service-core";

import { DeclareService, Implementation, Service } from "@svx/service-common";
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
export class UserInventoryServiceController implements UserInventoryService {
  // instance data

  mapper : Mapper

  // constructor

  constructor(@InjectRepository(UserEntity) private repo: Repository<UserEntity>) {
    const synchronizer = new AddressSynchronizer(s => s.id, t => t.id);

    this.mapper = new Mapper(
      // user

      mapping(UserEntity, UserDto, map => {
        map.from("id").to("id");
        map.from("name").to("name");
        map.from("addresses").to("addresses").apply({
          //target: (ctx) => ctx.set(ctx.mapper.mapList(ctx.sourceValue, {sourceType: AddressEntity})),
          source: syncRelation(synchronizer)
        });
      }),

      // address

      mapping(AddressEntity, AddressDto, map => {
         map.matching()
      }),
    ).setOptions({autoDeep: true});
  }

  // implement

  @Transactional()
  async findAll(): Promise<UserDto[]> {
    const entities = await this.repo.find({ relations: ["addresses"] });

    return this.mapper.mapList(entities);
  }

  @Transactional()
  async findOne(id: number): Promise<UserDto> {
    const entity = await this.repo.findOneOrFail({
      where: { id },
      relations: ["addresses"],
    });

    return this.mapper.map<UserEntity,UserDto>(entity);
  }

  @Transactional()
  async create(dto: UserDto): Promise<UserDto> {
    const entity = this.mapper.map<UserDto, UserEntity>(dto, { direction: "reverse"});

    const saved = await this.repo.save(entity);

    return this.mapper.map<UserEntity, UserDto>(saved);
  }

  @Transactional()
  async update(dto: UserDto): Promise<UserDto> {
   const entity = await this.repo.findOneOrFail({
      where: { id: dto.id! },
      relations: ["addresses"],
    });

    this.mapper.map(dto, {target: entity, direction: "reverse"});

    const saved = await this.repo.save(entity);

    return this.mapper.map(saved);
  }

  @Transactional()
  async delete(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
