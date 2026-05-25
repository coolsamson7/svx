import "reflect-metadata"

import { object, string, number, optional, array } from '@svx/common';
import type { InferObject } from '@svx/common'

import { TypeDescriptor, TypeInfo } from "./type-descriptor"
import { Implements, getImplementors, getImplementingSchema } from "./implements"
import { Reflectable } from "../packages/reflectable.decorator"

/* =========================================================
 * Schemas
 * ========================================================= */

const AddressSchema = object({ city: string().length(100) }, "Address")
const UserSchema    = object({
    id:        optional(number()),
    name:      string().length(100),
    addresses: array(AddressSchema),
}, "User")

type Address = InferObject<typeof AddressSchema>
type User    = InferObject<typeof UserSchema>

/* =========================================================
 * DTO classes
 * ========================================================= */

@Reflectable()
@Implements(AddressSchema)
class AddressDTO implements Address {
    city!: string
}

@Reflectable()
@Implements(UserSchema)
class UserDTO implements User {
    id: number | undefined
    name!: string
    addresses!: AddressDTO[]
}

/* =========================================================
 * Abstract service + concrete controller
 * ========================================================= */

@Reflectable()
abstract class UserService {
    abstract findAll(): Promise<User[]>
    abstract create(dto: User): Promise<User>
    abstract findOne(id: number): Promise<User>
    abstract delete(id: number): Promise<void>
}

@Reflectable()
class UserServiceController extends UserService {
    findAll(): Promise<UserDTO[]>                { return Promise.resolve([]) }
    create(dto: UserDTO): Promise<UserDTO>       { return Promise.resolve(dto) }
    findOne(_id: number): Promise<UserDTO>       { return Promise.resolve(new UserDTO()) }
    delete(_id: number): Promise<void>           { return Promise.resolve() }
}

/* =========================================================
 * Tests
 * ========================================================= */

describe("@Implements + TypeDescriptor schema support", () => {

    describe("@Implements registry", () => {
        it("getImplementors returns all implementing classes for a schema", () => {
            expect(getImplementors(UserSchema)).toContain(UserDTO)
            expect(getImplementors(AddressSchema)).toContain(AddressDTO)
        })

        it("registers class → schema", () => {
            expect(getImplementingSchema(UserDTO)).toBe(UserSchema)
            expect(getImplementingSchema(AddressDTO)).toBe(AddressSchema)
        })

        it("schema descriptor.implementations contains the implementing class descriptors", () => {
            const schemaTd = TypeDescriptor.forType(UserSchema)
            const classTd  = TypeDescriptor.forType(UserDTO)
            expect(schemaTd.implementations).toContain(classTd)
        })
    })

    describe("TypeInfo.source and .type", () => {
        it("source stores the raw value for a plain class", () => {
            const ti = new TypeInfo(UserDTO)
            expect(ti.source).toBe(UserDTO)
            expect(ti.type).toBe(UserDTO)
        })

        it("source stores the schema; type resolves to implementing class", () => {
            const ti = new TypeInfo(UserSchema)
            expect(ti.source).toBe(UserSchema)
            expect(ti.type).toBe(UserDTO)
        })

        it("type falls back to the schema itself when no @Implements is registered", () => {
            const orphan = object({ x: string() }, "_Orphan_")
            const ti = new TypeInfo(orphan)
            expect(ti.source).toBe(orphan)
            expect(ti.type).toBe(orphan)
        })

        it("isArray/isSet check source directly", () => {
            expect(new TypeInfo(Array).isArray()).toBe(true)
            expect(new TypeInfo(Set).isSet()).toBe(true)
            expect(new TypeInfo(UserDTO).isArray()).toBe(false)
        })
    })

    describe("TypeDescriptor.forType — schema vs class descriptors", () => {
        it("forType(string) returns the schema descriptor", () => {
            expect(TypeDescriptor.forType("User")).toBe(TypeDescriptor.forType(UserSchema))
        })

        it("forType(schema) returns a schema descriptor, NOT the class descriptor", () => {
            expect(TypeDescriptor.forType(UserSchema)).not.toBe(TypeDescriptor.forType(UserDTO))
        })

        it("forType(class).implements points to the schema descriptor", () => {
            expect(TypeDescriptor.forType(UserDTO).implements).toBe(TypeDescriptor.forType(UserSchema))
        })

        it("forType(schema) is idempotent — same instance each call", () => {
            expect(TypeDescriptor.forType(UserSchema)).toBe(TypeDescriptor.forType(UserSchema))
        })

        it("forType(string) throws when no schema is registered with that name", () => {
            expect(() => TypeDescriptor.forType("__NoSuchType__")).toThrow()
        })
    })

    describe("Schema descriptor — fields from object() shape", () => {
        it("has field 'name' with String fieldType and raw string() constraint", () => {
            const desc = TypeDescriptor.forType(UserSchema)
            const f = desc.getField("name")!
            expect(f.fieldType.source).toBe(String)
            expect(f.constraint).toBeDefined()           // the raw string().length(100) Type
        })

        it("has field 'id' — optional unwrapped to Number", () => {
            const desc = TypeDescriptor.forType(UserSchema)
            const f = desc.getField("id")!
            expect(f.fieldType.source).toBe(Number)
        })

        it("has field 'addresses' — Array with AddressSchema element", () => {
            const desc = TypeDescriptor.forType(UserSchema)
            const f = desc.getField("addresses")!
            expect(f.fieldType.isArray()).toBe(true)
            // element resolves to AddressDTO via TypeInfo.type
            expect(f.fieldType.elementType).toBe(AddressDTO)
        })
    })

    describe("Class descriptor — fields from transformer + constraints from schema", () => {
        it("has field 'name' typed as String (from transformer)", () => {
            const desc = TypeDescriptor.forType(UserDTO)
            expect(desc.getField("name")?.fieldType.source).toBe(String)
        })

        it("has field 'id' typed as Number (union T|undefined stripped)", () => {
            const desc = TypeDescriptor.forType(UserDTO)
            expect(desc.getField("id")?.fieldType.source).toBe(Number)
        })

        it("has field 'addresses' typed as Array<AddressDTO>", () => {
            const f = TypeDescriptor.forType(UserDTO).getField("addresses")!
            expect(f.fieldType.isArray()).toBe(true)
            expect(f.fieldType.elementType).toBe(AddressDTO)
        })

        it("field 'name' has constraint object copied from schema", () => {
            const classField  = TypeDescriptor.forType(UserDTO).getField("name")!
            const schemaField = TypeDescriptor.forType(UserSchema).getField("name")!
            expect(classField.constraint).toBeDefined()
            expect(classField.constraint).toBe(schemaField.constraint)
        })

        it("field 'name' constraint carries the length(100) rule", () => {
            const f = TypeDescriptor.forType(UserDTO).getField("name")!
            const lengthParams = f.constraint?.params4("length")
            expect(lengthParams).toBeDefined()
            expect(lengthParams.length).toBe(100)
        })

        it("field 'city' on AddressDTO constraint carries length(100)", () => {
            const f = TypeDescriptor.forType(AddressDTO).getField("city")!
            const lengthParams = f.constraint?.params4("length")
            expect(lengthParams).toBeDefined()
            expect(lengthParams.length).toBe(100)
        })
    })

    describe("UserService — transformer emits Type.get() for schema-typed methods", () => {
        it("findAll elementType resolves Promise<User[]> → UserDTO", () => {
            const m = TypeDescriptor.forType(UserService as any).getMethod("findAll")!
            expect(m.elementType).toBe(UserDTO)
        })

        it("create elementType resolves Promise<User> → UserDTO", () => {
            const m = TypeDescriptor.forType(UserService as any).getMethod("create")!
            expect(m.elementType).toBe(UserDTO)
        })

        it("create parameter type resolves User → UserDTO", () => {
            const m = TypeDescriptor.forType(UserService as any).getMethod("create")!
            expect(m.parameters[0].paramType.type).toBe(UserDTO)
        })

        it("delete return is void — elementType is undefined", () => {
            const m = TypeDescriptor.forType(UserService as any).getMethod("delete")!
            expect(m.elementType).toBeUndefined()
        })
    })

    describe("UserServiceController — transformer emits UserDTO directly", () => {
        it("findAll elementType is UserDTO", () => {
            const m = TypeDescriptor.forType(UserServiceController).getMethod("findAll")!
            expect(m.elementType).toBe(UserDTO)
        })

        it("create parameter type is UserDTO", () => {
            const m = TypeDescriptor.forType(UserServiceController).getMethod("create")!
            expect(m.parameters[0].paramType.type).toBe(UserDTO)
        })
    })
})
