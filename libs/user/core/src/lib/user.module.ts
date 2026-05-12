// inventory.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserEntity } from "./entity/user.entity";
import { UserInventoryServiceController } from "./user-inventory.service";
import { AddressEntity } from "./entity/address.entity";
import { ComponentModule, DefaultAddressResolution, LocalComponentDiscovery } from "@svx/service-nestjs";
import { UserComponent } from "@svx/user-interface";
import { UserComponentImpl } from './user.component';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, AddressEntity]),

    ComponentModule.forRoot({
      components: [UserComponent],
      discovery: LocalComponentDiscovery,
      addressResolution: new DefaultAddressResolution('local', 'rest'),
    }),
  ],
  providers: [UserComponentImpl],
  controllers: [UserInventoryServiceController],
})
export class UserModule {}
