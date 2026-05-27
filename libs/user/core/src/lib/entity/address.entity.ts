import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { UserEntity } from "./user.entity";
import { Reflectable, Implements } from "@svx/common";
import { AddressEntitySchema } from "./entity-schemas";

@Reflectable() @Implements(AddressEntitySchema) @Entity('addresses')
export class AddressEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 100 }) city!: string;
  @ManyToOne(() => UserEntity, u => u.addresses, { onDelete: 'CASCADE' }) user!: UserEntity;
}
