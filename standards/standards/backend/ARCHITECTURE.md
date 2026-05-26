# Architecture standards

## Layering

Services follow a three-layer structure. Dependencies only flow inward — outer layers
may call inner layers, never the reverse.

```
┌─────────────────────┐
│   interface layer   │  HTTP handlers, CLI commands, event consumers
├─────────────────────┤
│   domain layer      │  business logic, domain models, use cases
├─────────────────────┤
│infrastructure layer │  DB, external APIs, queues, file system
└─────────────────────┘
```

- Interface layer knows about domain layer. Never about infrastructure directly.
- Domain layer knows nothing about interface or infrastructure.
- Infrastructure layer implements interfaces defined in the domain layer (dependency inversion).

## Service boundaries

A service owns its data. No service reads another service's database directly.
Cross-service communication happens through published events or explicit API calls.

New services require an ADR. Do not extract a service to solve a code organisation
problem — that is a module boundary problem, not a service boundary problem.

## Data flow

- All writes go through the domain layer. No direct DB writes from handlers.
- Reads may bypass the domain layer when performance requires it, but this must be explicit
  (e.g. a dedicated read model or query service).
- Side effects (emails, webhooks, queue messages) are triggered after a successful write,
  never inline with the write transaction.

## Dependencies

- Do not add a new third-party dependency without checking if an existing one covers the need.
- Dependencies are added at the layer that needs them. Infrastructure dependencies
  (ORM, HTTP client) never appear in domain layer code.
- Pin dependency versions. Do not use version ranges in production code.

## Error handling

- Errors are values. Domain layer returns typed errors, not exceptions, wherever the
  language supports it.
- Infrastructure errors are wrapped before crossing into the domain layer.
  The domain never sees a raw database or network error.
- Unrecoverable errors crash loudly. Do not swallow panics or unknown exceptions.

---

## SVX-specific patterns

### Nx monorepo lib layout

Every domain is split into two libs:

```
libs/<domain>/
  interface/   — abstract service class, schemas, DTOs, types (no framework code)
  core/        — NestJS controller implementation, TypeORM entities, repositories
```

- Other services import only from `interface/`. Never import from another domain's `core/`.
- `interface/` has zero NestJS or TypeORM dependencies. It is framework-agnostic.
- `core/` implements the contracts declared in `interface/`.

### Service declaration and implementation

Services are declared once in `interface/` and implemented once in `core/`.

**`interface/` — declare the contract:**
```typescript
// libs/user/interface/src/lib/user-inventory.service.ts
@DeclareService()
export abstract class UserInventoryService extends Service {
  abstract findAll(): Promise<User[]>;
  abstract create(dto: CreateUser): Promise<User>;
}
```

**`core/` — implement with NestJS:**
```typescript
// libs/user/core/src/lib/user-inventory.service.ts
@Implementation()
@Controller('users')
export class UserInventoryServiceController extends UserInventoryService {
  @Get('all')
  async findAll(): Promise<UserDto[]> { ... }
}
```

Rules:
- `@DeclareService()` goes on the abstract class in `interface/`. It registers the service and enables AOP targeting via `classDecoratedWith(DeclareService)`.
- `@Implementation()` goes on the concrete NestJS class in `core/`. It wires the class into `ComponentModule`.
- The controller extends the abstract service class — NestJS route decorators go on the concrete class only.
- Never put `@Controller` or TypeORM annotations in `interface/`.

### Components

A `@DeclareComponent` groups related services into a deployable unit and declares communication channels.

```typescript
// interface/
@DeclareComponent({ name: 'user-component', services: [UserInventoryService] })
export abstract class UserComponent extends Component {}

// core/
@Implementation()
@Controller('user-component')
export class UserComponentImpl extends NestComponent(UserComponent) {
  get addresses(): ChannelAddress[] {
    return [new ChannelAddress('rest', 'http://localhost:3000')];
  }
}
```

- `services` lists every `@DeclareService` class the component exposes.
- `addresses` declares the transport endpoints (REST, gRPC, etc.).
- Other services call this component via generated client proxies, never via direct class import.

### Schema-first types

Types are defined as schemas in `interface/`, not as classes.

```typescript
// interface/
export const UserSchema = object({
  id:    optional(number()),
  name:  string().min(1).max(100),
  email: string().email(),
}, "User");

export type User = InferObject<typeof UserSchema>;
```

- Use `object()`, `string()`, `number()`, `array()`, `optional()` from `@svx/common`.
- Derive the TypeScript type with `InferObject<typeof Schema>`. Never hand-write the type separately.
- Schema names (second arg to `object()`) must be unique across the codebase — they are used for type registry lookups.
- Service abstract methods use the schema-derived type, not a class.

### DTOs

DTOs bridge the schema world and the NestJS/TypeORM world.

```typescript
@Reflectable()
@Implements(UserSchema)
export class UserDto implements User {
  id?: number;
  name!: string;
  email!: string;
}
```

- `@Reflectable()` triggers the TS descriptor transformer — required for runtime reflection and the mapper.
- `@Implements(Schema)` registers the DTO as the runtime implementation of the schema. Enables `getImplementors(Schema)` lookup and schema-based validation.
- DTOs live in `interface/` alongside the schema. Never in `core/`.
- Fields match the schema shape exactly. Add no extra fields.

### Entity-to-DTO mapping

Never expose TypeORM entities at the HTTP layer. Use `Mapper` to convert.

```typescript
// Declare mappings once, in the controller constructor.
this.mapper = new Mapper(
  mapping(UserEntity, UserDto, map => {
    map.from('id').to('id');
    map.from('addresses').to('addresses').apply({ target: syncRelation(synchronizer) });
  }),
  mapping(AddressEntity, AddressDto, map => { map.matching(); }),
);
```

- `map.matching()` auto-maps fields with the same name and compatible types.
- `map.from(x).to(y)` for explicit or renamed mappings.
- For relations (OneToMany, ManyToMany), use `RelationSynchronizer` with `.apply({ target: syncRelation(...) })` to update in-place without delete/recreate.
- Both classes must have `@Reflectable()` for `map.matching()` to work — the mapper reads the TS descriptor at runtime.
- The mapper is bidirectional: `mapper.map(entity)` → DTO forward, `mapper.map(dto, { direction: 'reverse' })` → entity.

### AOP aspects

Use aspects for cross-cutting concerns (logging, validation, auth). Do not repeat the same `@UsePipes` / `@UseGuards` boilerplate per method.

```typescript
@Injectable()
export class SchemaValidationAspect {
  @before(methods().classDecoratedWith(DeclareService as any))
  validateArgs(invocation: Invocation): void { ... }
}
```

- Aspect classes are NestJS `@Injectable()` providers declared in `NestAopModule`.
- Target methods with `methods().of(ConcreteClass)` (specific class) or `methods().classDecoratedWith(Decorator)` (all classes carrying a decorator).
- Use `@before` for validation, `@around` for logging/timing, `@after` for cleanup, `@error` for error translation.
- The AOP bridge in `NestAopModule` weaves aspects lazily on first method call — all providers are resolved before any request arrives, so aspect instances are always available.
- Keep aspect logic stateless or cache-keyed by `(ctor, methodName)` — aspects are shared across all instances.

### Reflection and `@Reflectable`

The `ts-descriptor-transformer` Vite/TS plugin generates a `static _descriptor` on every class decorated with `@Reflectable()`, `@DeclareService()`, or `@DeclareComponent()`. This descriptor stores field and method type info that survives transpilation.

- Add `@Reflectable()` to any class that needs runtime field type info (DTOs, entities used with Mapper, schema-validated classes).
- Do not call `TypeDescriptor.forType()` on `Object` or other built-in constructors — use the `ctor === Object` guard in any dynamic dispatch code.
- The transformer runs in Vite/Vitest via `descriptorPlugin()`. In Jest, it must be configured separately. Prefer Vitest for all unit tests.
- `TypeDescriptor.forType(cls).getFields()` returns typed field metadata. `TypeDescriptor.forType(cls).getMethods()` returns typed method metadata including parameter types.
