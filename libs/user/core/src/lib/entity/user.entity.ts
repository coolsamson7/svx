import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne, JoinColumn } from "typeorm";
import { AddressEntity } from "./address.entity";
import { Reflectable } from "@svx/common";

@Reflectable() @Entity()
export class UserEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @OneToMany(() => AddressEntity, a => a.user, { cascade: true })
  addresses!: AddressEntity[];
}
