// app.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserEntity } from "./user.entity";
import { AddressEntity } from "./address.entity";
import { UserInventoryModule } from "./user-inventory.module";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "postgres",
      host: "localhost",
      port: 5432,
      username: "postgres",
      password: "postgres",
      database: "inventory_db",
      entities: [UserEntity, AddressEntity],
      synchronize: true, // dev only
    }),

    UserInventoryModule,
  ],
})
export class AppModule {}
