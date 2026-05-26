---
description: Design or review a REST API endpoint — applies SVX REST conventions, NestJS controller structure, and service boundary rules. Use when adding a new route, reviewing an existing controller, or deciding how to model a request/response.
---

## Context

Read before acting:
- `standards/ARCHITECTURE.md` — service boundaries, interface/core split, entity-DTO mapping
- `standards/CODING_STANDARDS.md` — naming conventions

## REST conventions

- Route paths: lowercase kebab-case nouns — `/users`, `/user-invitations`
- Standard HTTP verbs: `GET` read, `POST` create, `PUT` full replace, `PATCH` partial update, `DELETE` remove
- Resource IDs in the path: `GET /users/:id`, not `GET /users?id=123`
- Collections return arrays directly: `GET /users` → `UserDto[]`

## Controller structure

The abstract service lives in `interface/`, the NestJS controller in `core/`.

```typescript
// interface/ — contract only, no NestJS imports
@DeclareService()
export abstract class WidgetService extends Service {
  abstract findAll(): Promise<Widget[]>;
  abstract create(dto: CreateWidget): Promise<Widget>;
}

// core/ — NestJS implementation
@Implementation()
@Controller('widgets')
export class WidgetServiceController extends WidgetService {
  @Get('all') @Transactional()
  async findAll(): Promise<WidgetDto[]> { ... }

  @Post('create') @Transactional()
  async create(@Body() dto: CreateWidget): Promise<WidgetDto> { ... }
}
```

## Request / response types

- Request bodies: use schema-derived types (`CreateWidget`, `Widget`) from `interface/`
- Response bodies: always return a DTO (`WidgetDto`), never a TypeORM entity
- Map entity ↔ DTO with `Mapper` declared in the constructor — no inline field assignment
- Do not add `@UsePipes` for validation — `SchemaValidationAspect` handles that via AOP

## What belongs where

| `interface/`                  | `core/`                             |
|-------------------------------|-------------------------------------|
| Abstract service class        | Concrete controller extending it    |
| Schemas (`WidgetSchema`)      | TypeORM entities                    |
| DTOs (`WidgetDto`)            | Repository injection                |
| Schema-derived types          | `@Transactional()` decorators       |

## Checklist

- [ ] Route path is kebab-case noun
- [ ] Response type is a DTO, not an entity
- [ ] Mapper declared in constructor
- [ ] All DB operations wrapped in `@Transactional()`
- [ ] Abstract method added to the service class in `interface/`
- [ ] No `@UsePipes` — validation handled by `SchemaValidationAspect`
