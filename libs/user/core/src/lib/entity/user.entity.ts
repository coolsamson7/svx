import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne, JoinColumn } from "typeorm";
import { AddressEntity } from "./address.entity";

import { ArrayOf, Field } from "@svx/common";

@Entity()
export class UserEntity {
  @Field() @PrimaryGeneratedColumn()
  id!: number;

  @Field() @Column()
  name!: string;

  @OneToMany(() => AddressEntity, a => a.user, { cascade: true })
  //@OneToOne(() => AddressEntity, { cascade: true })
  //@JoinColumn()
  @ArrayOf(AddressEntity)
  @Field() addresses!: AddressEntity[];
}
