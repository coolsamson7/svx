// inventory.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserEntity } from "./user.entity";
import { UserInventoryService } from "./user-inventory.service";
import { UserInventoryController } from "./user-inventory.controller";
import { AddressEntity } from "./address.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, AddressEntity]),
  ],
  controllers: [UserInventoryController],
  providers: [
    UserInventoryService
  ],
})
export class UserInventoryModule {}
