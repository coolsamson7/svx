// inventory.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserEntity } from "./user.entity";
import { UserInventoryServiceController } from "./user-inventory.service";
import { AddressEntity } from "./address.entity";
import { ComponentModule, DefaultAddressResolution, LocalComponentDiscovery } from "@svx/portal";
import { UserInventoryComponent } from "./user-inventory.component";


@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, AddressEntity]),

    ComponentModule.forRoot({
          components: [UserInventoryComponent],
          discovery: LocalComponentDiscovery,
          addressResolution: new DefaultAddressResolution("local", "rest")
    })
    ],
    controllers: [UserInventoryServiceController]
})
export class UserInventoryModule {}
