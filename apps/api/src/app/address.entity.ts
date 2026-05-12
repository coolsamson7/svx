import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";

import { UserEntity } from "./user.entity";
import { Field } from "@svx/common";

@Entity()
export class AddressEntity {
  @Field() @PrimaryGeneratedColumn() id!: number;
  @Field()  @Column() city!: string;
  @ManyToOne(() => UserEntity, u => u.addresses, { onDelete: 'CASCADE' }) user!: UserEntity;
}
