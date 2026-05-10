import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { AddressEntity } from './address.entity';
import { UserInventoryModule } from './user-inventory.module';
import { addTransactionalDataSource, initializeTransactionalContext } from 'typeorm-transactional';
import { DataSource } from 'typeorm';

describe('UserInventoryController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    initializeTransactionalContext();

    app = await Test.createTestingModule({
         imports: [
           TypeOrmModule.forRoot({
             type: "postgres",
             host: "localhost",
             port: 5432,
             username: "postgres",
             password: "postgres",
             database: "postgres",
             entities: [UserEntity, AddressEntity],
             synchronize: true,
           }),

           UserInventoryModule
         ],
       }).compile();

        const dataSource = app.get(DataSource);
       
        addTransactionalDataSource(dataSource);

       //service = app.get(UserInventoryService);
     });

  describe('user inventory controller', () => {
    it('should return users', async () => {
      const controller = app.get<UserInventoryController>(UserInventoryController);

      const users = await controller.findAll();
      console.log(users);
    });
  });
});
