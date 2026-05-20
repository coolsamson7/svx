import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { UserEntity } from "./user.entity";
import { Reflectable } from "@svx/common";

@Reflectable() @Entity()
export class AddressEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column() city!: string;
  @ManyToOne(() => UserEntity, u => u.addresses, { onDelete: 'CASCADE' }) user!: UserEntity;
}
