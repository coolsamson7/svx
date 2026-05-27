import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { AddressEntity } from "./address.entity";
import { Reflectable, Implements } from "@svx/common";
import { UserEntitySchema } from "./entity-schemas";

@Reflectable() @Implements(UserEntitySchema) @Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @OneToMany(() => AddressEntity, a => a.user, { cascade: true })
  addresses!: AddressEntity[];
}
