import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { addTransactionalDataSource, initializeTransactionalContext } from 'typeorm-transactional';
import { DataSource } from 'typeorm';
import { UserModule, UserEntity, AddressEntity, UserInventoryServiceController } from '@svx/user-core';
import { NestAopModule } from './aop/nest-aop.module';

describe('UserInventoryController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    initializeTransactionalContext();

    app = await Test.createTestingModule({
         imports: [
           NestAopModule,
           TypeOrmModule.forRootAsync({
             useFactory: () => ({
               type: "postgres",
               host: "localhost",
               port: 5433,
               username: "postgres",
               password: "postgres",
               database: "postgres",
               entities: [UserEntity, AddressEntity],
               synchronize: true,
             }),
             dataSourceFactory: async (options) => {
               if (!options) throw new Error('Invalid options passed');
               const ds = new DataSource(options);
               await ds.initialize();
               try {
                 addTransactionalDataSource(ds);
               } catch (err: any) {
                 if (!err?.message?.includes('has already added')) throw err;
               }
               return ds;
             }
           }),

           UserModule
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
