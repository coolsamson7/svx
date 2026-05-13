import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { AddressEntity } from './address.entity';
import { UserInventoryModule } from './user-inventory.module';
import { addTransactionalDataSource, initializeTransactionalContext } from 'typeorm-transactional';
import { DataSource } from 'typeorm';
import { UserInventoryServiceController } from './user-inventory.service';

describe('UserInventoryController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    initializeTransactionalContext();

    app = await Test.createTestingModule({
         imports: [
           TypeOrmModule.forRootAsync({
             useFactory: () => ({
               type: "postgres",
               host: "localhost",
               port: 5432,
               username: "postgres",
               password: "postgres",
               database: "postgres",
               entities: [UserEntity, AddressEntity],
               synchronize: true,
             }),
             dataSourceFactory: async (options) => {
               if (!options) throw new Error('Invalid options passed');
               return addTransactionalDataSource(new DataSource(options));
             }
           }),

           UserInventoryModule
         ],
       }).compile();

       //service = app.get(UserInventoryService);
     });

  describe('user inventory controller', () => {
    it('should return users', async () => {
      const controller = app.get(UserInventoryServiceController);

      const users = await controller.findAll();
      console.log(users);
    });
  });
});
