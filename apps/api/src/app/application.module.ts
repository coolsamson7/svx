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
          host: process.env['DB_HOST'] ?? 'localhost',
          port: Number(process.env['DB_PORT'] ?? 5432),
          username: process.env['DB_USER'] ?? 'postgres',
          password: process.env['DB_PASSWORD'] ?? 'postgres',
          database: process.env['DB_NAME'] ?? 'postgres',
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

        await dataSource.initialize();

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
