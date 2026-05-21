import { Test } from "@nestjs/testing";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { addTransactionalDataSource, initializeTransactionalContext } from "typeorm-transactional";
import { UserEntity, AddressEntity, UserInventoryServiceController } from "@svx/user-core";
import { UserDto, AddressDto, UserInventoryService } from "@svx/user-interface";



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

        TypeOrmModule.forFeature([UserEntity, AddressEntity]),
      ],
      providers: [UserInventoryServiceController],
    }).compile();

    service = app.get(UserInventoryServiceController);
  });

  it("should create, update and re-read a user", async () => {
    const addressDto = new AddressDto();
    addressDto.city = "Cologne";

    const userDto: UserDto = new UserDto();
    userDto.name = "John Doe";
    userDto.addresses = [addressDto];

    const created = await service.create(userDto);
    console.log("created user " + created.id);

    const user = await service.findOne(created.id!);
    console.log("reread user " + user.id);

    user.name = user.name + "X";
    console.log("update user " + user.id + " with name " + user.name);

    const updated = await service.update(user);
    console.log("updated user " + updated.id + " with name " + updated.name);

    const reread = await service.findOne(updated.id!);
    console.log("check reread updated user " + reread.id + " with name " + reread.name);

    if (reread.name !== updated.name)
      throw new Error("Name was not updated");
  });
});
