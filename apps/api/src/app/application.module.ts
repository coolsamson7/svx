import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from 'typeorm-transactional';

import { UserEntity } from './user.entity';
import { AddressEntity } from './address.entity';

import { UserInventoryModule } from './user-inventory.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'secure',
        database: 'postgres',
        entities: [
          UserEntity,
          AddressEntity,
        ],
        // synchronize: true,
        synchronize: false, // Turn off automatic schema sync
        migrationsRun: true, // Run generated migrations sequentially on boot
      }),
      async dataSourceFactory(options) {
        if (!options) throw new Error('Invalid options passed');
        return addTransactionalDataSource(new DataSource(options));
      }
    }),

    UserInventoryModule,
  ],
})
export class ApplicationModule {}
