import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserEntity } from "./entity/user.entity";
import { AddressEntity } from "./entity/address.entity";
import { ComponentModule, DefaultAddressResolution, LocalComponentDiscovery } from "@svx/service-nestjs";
import { UserComponent } from "@svx/user-interface";

// @Implementation() classes are auto-registered as providers/controllers by ComponentModule
import './user-inventory.service';
import './user.component';

@Module({
  imports: [
    ComponentModule.forRoot({
      components: [UserComponent],
      discovery: LocalComponentDiscovery,
      addressResolution: new DefaultAddressResolution('local', 'rest'),
      imports: [TypeOrmModule.forFeature([UserEntity, AddressEntity])],
    }),
  ],
})
export class UserModule {}
