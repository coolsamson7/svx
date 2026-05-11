import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne, JoinColumn } from "typeorm";
import { AddressEntity } from "./address.entity";


import { ArrayOf } from "@svx/portal";

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
