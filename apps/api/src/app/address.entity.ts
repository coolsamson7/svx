import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";

import { field } from "./field.decorator";

import { UserEntity } from "./user.entity";

@Entity()
export class AddressEntity {
  @field() @PrimaryGeneratedColumn()
  id!: number;

  @field()  @Column()
  city!: string;

  @ManyToOne(() => UserEntity, u => u.addresses)
  user!: UserEntity;
}
