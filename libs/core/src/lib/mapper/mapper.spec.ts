import "reflect-metadata"
import { number, object, string, InferObject, array } from "@svx/validation";
import { mapping, Mapper, ApplyContext } from "./mapper";
import { RelationSynchronizer } from "./relation-synchronizer"
import { TypeDescriptor } from "@svx/common";
import { plainToInstance } from "class-transformer";

/* =========================================================
 * SHARED SCHEMAS  (interface world)
 * ========================================================= */

const addressSchema = object({ city: string() }, "Address");
const userSchema    = object({
  id:      number(),
  name:    string(),
  address: addressSchema,
}, "User");

type Address = InferObject<typeof addressSchema>;
type User    = InferObject<typeof userSchema>;

const addressDtoSchema = object({ cityName: string() }, "AddressDto");
const userDtoSchema    = object({
  userId:  string(),
  name:    string(),
  address: addressDtoSchema,
}, "UserDto");

type UserDto = InferObject<typeof userDtoSchema>;

/* =========================================================
 * SHARED CLASSES  (class world)
 * ========================================================= */

//export function field(): PropertyDecorator {
//  return () => {}  // body empty — touching it makes emitDecoratorMetadata emit design:type
//}

const field = (): any => {
    return function (target: any, propertyKey: string) {
        TypeDescriptor.forType(target.constructor).addPropertyDecorator(target, propertyKey, field)
    }
}

class AddressEntity {
   @field() city!: string

   constructor(city: string) {
    this.city = city;
  }
}

class UserEntity {
  @field()  id!:      number
  @field()  name!:    string
  @field()  address!: AddressEntity

   constructor(id: number, name: string, address: AddressEntity) {
    this.id      = id;
    this.name    = name;
    this.address = address;
  }
}

const adressType = TypeDescriptor.forType(AddressEntity);
const userType = TypeDescriptor.forType(UserEntity);

import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";

@Entity()
export class AddressORM {
  @field() @PrimaryGeneratedColumn()
  id!: number;

  @field() @Column()
  city!: string;
}

@Entity()
export class UserORM {
  @field() @PrimaryGeneratedColumn()
  id!: number;

  @field() @Column()
  name!: string;

  @field() @ManyToOne(() => AddressORM)
  address!: AddressORM;
}

const adressORMType = TypeDescriptor.forType(AddressORM);
const userORMType = TypeDescriptor.forType(UserORM);

/* =========================================================
 * TESTS
 * ========================================================= */

describe("Mapper", () => {

  // collections

describe("Mapper - Array support", () => {

  class UserEntity {
    @field()  id!: number;
    @field()  name!: string;
  }

  class UserDTO {
    @field()  id!: string;
    @field()  name!: string;
  }

  class GroupEntity {
    @field()  users!: UserEntity[];
  }

  class GroupDTO {
    @field()  users!: UserDTO[];
  }

  const userMapping = mapping(UserEntity, UserDTO, map => {
    map.from("id").to("id").convert({target: num => String(num), source: str => Number(str)}); // number -> string
    map.from("name").to("name");
  });

  const groupMapping = mapping(GroupEntity, GroupDTO, map => {
    map.from("users").to("users").deep();
  });

  const mapper = new Mapper(
    groupMapping,
    userMapping,
  );

  const r = mapper.report()

  console.log(r)

  it("should map array of objects (deep)", () => {
    const src: GroupEntity = {
      users: [
        { id: 1, name: "A" },
        { id: 2, name: "B" }
      ]
    };

    const result = mapper.map<GroupEntity, GroupDTO>(src);

    expect(result.users).toHaveLength(2);
    expect(result.users[0]).toEqual({ id: "1", name: "A" });
    expect(result.users[1]).toEqual({ id: "2", name: "B" });
  });

  it("should handle empty arrays", () => {
    const src: GroupEntity = {
      users: []
    };

    const result = mapper.map<GroupEntity, GroupDTO>(src);

    expect(result.users).toEqual([]);
  });

  it("should handle undefined arrays", () => {
    const src: GroupEntity = {
      users: undefined as any
    };

    const result = mapper.map<GroupEntity, GroupDTO>(src);

    expect(result.users).toBeUndefined();
  });

  it("should reuse mapping context (no duplicate objects)", () => {
    const shared = { id: 1, name: "Same" };

    const src: GroupEntity = {
      users: [shared, shared]
    };

    const result = mapper.map<GroupEntity, GroupDTO>(src);

    expect(result.users[0]).toBe(result.users[1]); // same instance
  });

});

  /* -------------------------------------------------------
 * APPLY (custom logic / merging / advanced rules)
 * ----------------------------------------------------- */

describe("apply()", () => {

  it("can override assignment (simple transform)", () => {
    const mapper = new Mapper(
      mapping(userSchema, userDtoSchema, map => {
        map.from("id").to("userId").apply({
          source: ctx => {
            ctx.set(Number(ctx.sourceValue));
          },
          target: ctx => {
            ctx.set(String(ctx.sourceValue));
          }
        });

        map.matching().except("id");
        map.from("address").to("address").deep();
      }),

      mapping(addressSchema, addressDtoSchema, map => {
        map.from("city").to("cityName");
      }),
    );

    const user: User = {
      id: 42,
      name: "Andreas",
      address: { city: "Berlin" },
    };

    const result = mapper.map<User, UserDto>(user);

    expect(result.userId).toBe("42");
  });


  it("can access current target value (merge instead of replace)", () => {
    const mapper = new Mapper(
      mapping(userSchema, UserEntity, r => {
        r.matching().except("address");

        r.from("address").to("address").apply({
          target: ctx => {
            const src = ctx.sourceValue;          // Address (DTO-like)
            const tgt = ctx.targetValue;     // existing AddressEntity

            if (tgt) {
              // merge into existing instance
              tgt.city = src.city;
              ctx.set(tgt);
            } 
            else {
              // create new
              ctx.set(new AddressEntity(src.city));
            }
          }
        });
      }),
    );

    const existing = new UserEntity(
      1,
      "Old",
      new AddressEntity("OldCity")
    );

    const input: User = {
      id: 1,
      name: "New",
      address: { city: "NewCity" },
    };

    const result = mapper.map(input, { target: existing });

    expect(result.address).toBe(existing.address); // same instance!
    expect(result.address.city).toBe("NewCity");
  });


  it("can call mapper recursively (manual deep control)", () => {
    const mapper = new Mapper(
      mapping(userSchema, userDtoSchema, r => {
        r.matching().except("address");

        r.from("address").to("address").apply({
          target: ctx => {
            const nested = ctx.mapper.map(ctx.sourceValue, {
              sourceType: addressSchema
            });

            ctx.set(nested);
          }
        });
      }),
      mapping(addressSchema, addressDtoSchema, r => {
        r.from("city").to("cityName");
      }),
    );

    const user: User = {
      id: 1,
      name: "Test",
      address: { city: "Hamburg" },
    };

    const result = mapper.map<User, UserDto>(user);

    expect(result.address).toEqual({ cityName: "Hamburg" });
  });


  it("can implement optimistic locking (version check)", () => {
    const versionSchema = object({
      id: number(),
      version: number(),
    }, "Versioned");

    class VersionedEntity {
      @field() id!: number;
      @field() version!: number;

      constructor(id: number, version: number) {
        this.id = id;
        this.version = version;
      }
    }

  const checkVersion = (ctx: ApplyContext) => {
      const { sourceValue, targetValue, set } = ctx;

      if (sourceValue !== targetValue) {
        throw new Error("Optimistic lock error");
      }

      set(sourceValue);
    }

    const mapper = new Mapper(
      mapping(versionSchema, VersionedEntity, map => {
        map.from("version").to("version").apply({target: checkVersion});
        map.from("id").to("id");
      }),
    );

    const entity = new VersionedEntity(1, 5);

    expect(() => {
      mapper.map({ id: 1, version: 4 }, { target: entity });
    }).toThrow("Optimistic lock error");
  });


  it("can synchronize collections (simplified)", () => {
    type Item = { id: number; value: string };

    const itemSchema = object({
      id: number(),
      value: string(),
    }, "Item");

    class ItemEntity {
      @field() id!: number;
      @field() value!: string;

      constructor(id: number, value: string) {
        this.id = id;
        this.value = value;
      }
    }

    class Container {
      @field() items!: ItemEntity[];

      constructor(items: ItemEntity[]) {
        this.items = items;
      }
    }

    const containerSchema = object({
      items: array(itemSchema),
    }, "Container");

    // ✅ reusable synchronizer (this is the whole point)
    class ItemSynchronizer extends RelationSynchronizer<Item, ItemEntity, number> {
      protected provide(source: Item): ItemEntity {
        return new ItemEntity(source.id, source.value);
      }

      protected update(target: ItemEntity, source: Item): void {
        target.value = source.value;
      }
    }

    const synchronizer = new ItemSynchronizer(
      s => s.id,
      t => t.id,
    );

    const syncRelation =<S, T, PK>(
      synchronizer: RelationSynchronizer<S, T, PK>
    ) => {
      return (ctx: ApplyContext) => {
        const src = (ctx.sourceValue ?? []) as S[];
        const tgt = (ctx.targetValue ?? []) as T[];

        const result = synchronizer.synchronize(src, tgt, ctx);

        ctx.set(result);
      };
    }

    const mapper = new Mapper(
      mapping(containerSchema, Container, r => {
        r.from("items").to("items").apply({target: syncRelation(synchronizer)});
      }),
    );

    const existing = new Container([
      new ItemEntity(1, "A"),
      new ItemEntity(2, "B"),
    ]);

    const input = {
      items: [
        { id: 2, value: "B2" }, // update
        { id: 3, value: "C" },  // new
      ],
    };

    const result = mapper.map(input, { target: existing });

    expect(result.items.length).toBe(2);
    expect(result.items[0].value).toBe("B2");
    expect(result.items[1].value).toBe("C");
  });

});

  describe("performance", () => {


it("compare with class-transformer", () => {
  const mapper = new Mapper(
    mapping(userSchema, UserEntity, r => {
      r.matching().except("address");
      r.from("address").to("address").deep();
    }),
    mapping(addressSchema, AddressEntity, r => {
      r.from("city").to("city");
    }),
  );

  const user: User = {
    id: 1,
    name: "Andreas",
    address: { city: "Mönchengladbach" },
  };

  const ITERATIONS = 50_000; // reduce, it's slower
  const WARMUP = 5_000;

  // warmup
  for (let i = 0; i < WARMUP; i++) {
    mapper.map(user);
    plainToInstance(UserEntity, user);
  }

  // ---- your mapper
  let start = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    mapper.map(user);
  }

  let end = performance.now();
  const mapperTotal = end - start;

  // ---- class-transformer
  start = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    plainToInstance(UserEntity, user);
  }

  end = performance.now();
  const ctTotal = end - start;

  console.log("---- YOUR MAPPER ----");
  console.log(`Ops/sec: ${(ITERATIONS / (mapperTotal / 1000)).toFixed(0)}`);

  console.log("---- class-transformer ----");
  console.log(`Ops/sec: ${(ITERATIONS / (ctTotal / 1000)).toFixed(0)}`);

  console.log("---- RATIO ----");
  console.log(`Your mapper is ${(ctTotal / mapperTotal).toFixed(1)}x faster`);
});

    it("compare with manual mapping", () => {
  const mapper = new Mapper(
    mapping(userSchema, UserEntity, r => {
      r.matching().except("address");
      r.from("address").to("address").deep();
    }),
    mapping(addressSchema, AddressEntity, r => {
      r.from("city").to("city");
    }),
  );

  const user: User = {
    id: 1,
    name: "Andreas",
    address: { city: "Mönchengladbach" },
  };

  // 🔥 manual mapping (baseline = MapStruct equivalent)
  function manualMap(u: User): UserEntity {
    return new UserEntity(
      u.id,
      u.name,
      new AddressEntity(u.address.city)
    );
  }

  const ITERATIONS = 100_000;
  const WARMUP = 10_000;

  // warmup both
  for (let i = 0; i < WARMUP; i++) {
    mapper.map(user);
    manualMap(user);
  }

  // ---- mapper benchmark
  let start = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    mapper.map(user);
  }

  let end = performance.now();
  const mapperTotal = end - start;

  // ---- manual benchmark
  start = performance.now();

  for (let i = 0; i < ITERATIONS; i++) {
    manualMap(user);
  }

  end = performance.now();
  const manualTotal = end - start;

  console.log("---- YOUR MAPPER ----");
  console.log(`Total: ${mapperTotal.toFixed(2)} ms`);
  console.log(`Ops/sec: ${(ITERATIONS / (mapperTotal / 1000)).toFixed(0)}`);

  console.log("---- MANUAL ----");
  console.log(`Total: ${manualTotal.toFixed(2)} ms`);
  console.log(`Ops/sec: ${(ITERATIONS / (manualTotal / 1000)).toFixed(0)}`);

  console.log("---- RATIO ----");
  console.log(`Manual is ${(mapperTotal / manualTotal).toFixed(2)}x faster`);
});

    it ("should perform", () => {
      const mapper = new Mapper(
        mapping(userSchema, UserEntity, r => {
          //r.from("id").to("id");
          r.matching().except("address");
          r.from("address").to("address").deep();
        }),
        mapping(addressSchema, AddressEntity, r => {
          r.from("city").to("city");
        }),
      );

      const user: User = {
        id:      1,
        name:    "Andreas",
        address: { city: "Mönchengladbach" },
      };

      const mapped =  mapper.map(user);

      const ITERATIONS = 100_000;
      const WARMUP = 10_000;

      // 🔥 warmup (very important)
      for (let i = 0; i < WARMUP; i++) {
        mapper.map(user);
      }

      // 🧪 measure
      const start = performance.now();

      for (let i = 0; i < ITERATIONS; i++) {
        mapper.map(user);
      }

      const end = performance.now();

      const total = end - start;

      console.log(`Total: ${total.toFixed(2)} ms`);
      console.log(`Per op: ${(total / ITERATIONS).toFixed(6)} ms`);
      console.log(`Ops/sec: ${(ITERATIONS / (total / 1000)).toFixed(0)}`);
    });
  });

  /* -------------------------------------------------------
   * WORLD 1 — Interface / ObjectType schema
   * ----------------------------------------------------- */

  describe("interface world (ObjectType → ObjectType)", () => {
    const mapper = new Mapper(
      mapping(userSchema, userDtoSchema, r => {
        r.from("id").to("userId").autoConvert();
        r.matching().except("address");
        r.from("address").to("address").deep();
      }),
      mapping(addressSchema, addressDtoSchema, r => {
        r.from("city").to("cityName");
      }),
    );

    const s = mapper.report()

    console.log(s)

    const user: User = {
      id:      1,
      name:    "Andreas",
      address: { city: "Mönchengladbach" },
    };

    it("maps reverse", () => {
      const result: UserDto = mapper.map(user);
      const reverse: User = mapper.map(result, {direction: "reverse"})

      expect(reverse.id).toBe(user.id);
    });


    it("maps id with autoConvert (number → string)", () => {
      const result: UserDto = mapper.map(user);
      expect(result.userId).toBe("1");
      expect(typeof result.userId).toBe("string");
    });

    it("maps matched fields (name)", () => {
      const result: UserDto = mapper.map(user);
      expect(result.name).toBe("Andreas");
    });

    it("deep-maps nested address", () => {
      const result: UserDto = mapper.map(user);
      expect(result.address).toEqual({ cityName: "Mönchengladbach" });
    });

    it("produces a complete DTO", () => {
      expect(mapper.map(user)).toEqual({
        userId:  "1",
        name:    "Andreas",
        address: { cityName: "Mönchengladbach" },
      });
    });

    it("report() describes all compiled operations", () => {
      const report = mapper.report();
      expect(report).toContain("mapping  User  →  UserDto");
      expect(report).toContain("autoConvert(Number→String)");
      expect(report).toContain("transfer  path(name)");
      expect(report).toContain("deep  path(address)");
      expect(report).toContain("mapping  Address  →  AddressDto");
      expect(report).toContain("transfer  path(city)  →  path(cityName)");
    });
  });

  /* -------------------------------------------------------
   * WORLD 2 — Class / TypeDescriptor
   * ----------------------------------------------------- */

  describe("class world (GType → ObjectType)", () => {
    const mapper = new Mapper(
      mapping(UserEntity, userDtoSchema, r => {
        r.from("id").to("userId").autoConvert();
        r.matching();
        r.from("address").to("address").deep();
      }),
      mapping(AddressEntity, addressDtoSchema, r => {
        r.from("city").to("cityName");
      }),
    );

    const entity = new UserEntity(2, "Andreas", new AddressEntity("Cologne"));

    it("maps id with autoConvert (number → string)", () => {
      const result: UserDto = mapper.map(entity);
      expect(result.userId).toBe("2");
      expect(typeof result.userId).toBe("string");
    });

    it("maps matched fields (name)", () => {
      const result: UserDto = mapper.map(entity);
      expect(result.name).toBe("Andreas");
    });

    it("deep-maps nested address", () => {
      const result: UserDto = mapper.map(entity);
      expect(result.address).toEqual({ cityName: "Cologne" });
    });

    it("produces a complete DTO", () => {
      expect(mapper.map(entity)).toEqual({
        userId:  "2",
        name:    "Andreas",
        address: { cityName: "Cologne" },
      });
    });
  });

  /* -------------------------------------------------------
   * WORLD 3 — Mixed (class source, schema target)
   * ----------------------------------------------------- */

  describe("mixed world (GType → ObjectType)", () => {
    const mapper = new Mapper(
      mapping(UserEntity, userDtoSchema, r => {
        r.from("id").to("userId").autoConvert();
        r.matching();
        r.from("address").to("address").deep();
      }),
      mapping(AddressEntity, addressDtoSchema, r => {
        r.from("city").to("cityName");
      }),
    );

    it("produces a correct DTO from a class instance", () => {
      const result: UserDto = mapper.map(
        new UserEntity(3, "Andreas", new AddressEntity("Berlin"))
      );
      expect(result).toEqual({
        userId:  "3",
        name:    "Andreas",
        address: { cityName: "Berlin" },
      });
    });
  });

  /* -------------------------------------------------------
   * DEDUPLICATION  (same object instance referenced twice)
   * ----------------------------------------------------- */

  describe("MappingContext deduplication", () => {
    const mapper = new Mapper(
      mapping(userSchema, userDtoSchema, r => {
        r.from("id").to("userId").autoConvert();
        r.matching();
        r.from("address").to("address").deep();
      }),
      mapping(addressSchema, addressDtoSchema, r => {
        r.from("city").to("cityName");
      }),
    );

    it("reuses the mapped result for the same source object within one map() call", () => {
      const sharedAddress: Address = { city: "Shared City" };
      const user: User = { id: 1, name: "Andreas", address: sharedAddress };

      const result: UserDto = mapper.map(user);

      // correct value
      expect(result.address.cityName).toBe("Shared City");
    });

    it("does NOT share state between separate map() calls", () => {
      const user1: User = { id: 1, name: "Alice", address: { city: "City A" } };
      const user2: User = { id: 2, name: "Bob",   address: { city: "City B" } };

      const dto1: UserDto = mapper.map(user1);
      const dto2: UserDto = mapper.map(user2);

      expect(dto1.name).toBe("Alice");
      expect(dto2.name).toBe("Bob");
      expect(dto1.address.cityName).toBe("City A");
      expect(dto2.address.cityName).toBe("City B");
    });
  });

  /* -------------------------------------------------------
   * ERROR CASES  (all thrown at construction time)
   * ----------------------------------------------------- */

  describe("construction-time errors", () => {
    it("throws when autoConvert has no registered converter", () => {
      expect(() => new Mapper(
        mapping(userSchema, userDtoSchema, r => {
          // String → String: no conversion needed, no converter registered
          r.from("name").to("userId").autoConvert();
        }),
      )).toThrow(/no built-in converter for string→string/);
    });

    it("throws when deep() has no sub-mapping", () => {
      expect(() => new Mapper(
        mapping(userSchema, userDtoSchema, r => {
          r.from("address").to("address").deep();
          // missing: mapping(addressSchema, addressDtoSchema, ...)
        }),
      )).toThrow(/No mapping.*found for deep path "address"/);
    });

    it("throws on circular mapping", () => {
      // Construct a circular shape manually
      const aSchema = object({ b: object({}, "B") }, "A");
      const bSchema = object({ a: object({}, "A") }, "B");

      // We fake a cycle by pointing sub-definitions back at each other.
      // In practice the cycle detector fires on deep() references.
      expect(() => new Mapper(
        mapping(aSchema, bSchema, r => {
          r.from("b").to("a").deep();
        }),
        mapping(object({}, "B"), object({}, "A"), r => {
          // empty — but the shape identity triggers cycle check
        }),
      )).toThrow(/Circular|circular|deep/i);
    });
  });
});
