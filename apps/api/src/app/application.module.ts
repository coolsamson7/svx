import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from 'typeorm-transactional';

import { UserEntity } from './user.entity';
import { AddressEntity } from './address.entity';

import { UserInventoryModule } from './user-inventory.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        Logger.log('Initializing TypeORM...', 'TypeOrmFactory');
        return {
          type: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'postgres',
          password: 'secure',
          database: 'inventory_db',
          entities: [
            UserEntity,
            AddressEntity,
          ],
          synchronize: process.env['NODE_ENV'] !== 'production',
        };
      },
      async dataSourceFactory(options) {
        if (!options) throw new Error('Invalid options passed');
        Logger.log('Creating DataSource...', 'TypeOrmFactory');
        const dataSource = new DataSource(options);
        try {
          addTransactionalDataSource(dataSource);
        } catch (err: any) {
          if (!err?.message?.includes('has already added')) throw err;
        }
        return dataSource;
      }
    }),

    UserInventoryModule,
  ],
})
export class ApplicationModule {}
