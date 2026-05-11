import { Test } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UserEntity } from "./user.entity";
import { UserInventoryService } from "./user-inventory.service";
import { AddressEntity } from "./address.entity";
import { UserDto } from "./user.dto";
import { AddressDto } from "./address.dto";
import { DataSource } from "typeorm";
import { addTransactionalDataSource, initializeTransactionalContext } from "typeorm-transactional";



describe("UserService", () => {
  let service: UserInventoryService;

  beforeAll(async () => {
    initializeTransactionalContext();

    const app = await Test.createTestingModule({
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

        TypeOrmModule.forFeature([UserEntity, AddressEntity]),
      ],
      providers: [UserInventoryService],
    }).compile();

    service = app.get(UserInventoryService);
  });

  it("should find all", async () => {
    const users = await service.findAll();
    console.log(users);

    const addressDto = new AddressDto()

    addressDto.city = "Cologne";

    const userDto: UserDto = new UserDto();

    userDto.name = "John Doe";
    userDto.addresses = [addressDto];

    const created = await service.create(userDto);

    console.log(" created user " + created.id);

    await service.findOne(created.id!).then(user => {
      console.log("reread user " + user.id);

      // change it

      user.name = user.name + "X";

      console.log("update user " + user.id + " with name " + user.name);

      service.update(user).then(updated => {
        console.log("updated user " + updated.id + " with name " + updated.name);

        // reread

        console.log("reread user " + updated.id);

        const updatedUser = service.findOne(updated.id!).then(u => {
           console.log("check reread updated user " + updated.id + " with name " + updated.name);

          if (u.name !== updated.name)
            throw new Error("Name was not updated");
        });
      });
    })
  });
});
