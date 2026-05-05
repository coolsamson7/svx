import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne, JoinColumn } from "typeorm";
import { AddressEntity } from "./address.entity";

import { field } from "./field.decorator";
import { ArrayOf } from "@svx/portal";

@Entity()
export class UserEntity {
  @field() @PrimaryGeneratedColumn()
  id!: number;

  @field() @Column()
  name!: string;

  @OneToMany(() => AddressEntity, a => a.user, { cascade: true })
  //@OneToOne(() => AddressEntity, { cascade: true })
  //@JoinColumn()
  @ArrayOf(AddressEntity)
  @field() addresses!: AddressEntity[];
}
