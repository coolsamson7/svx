---
description: Scaffold a new service following the SVX DeclareService/Implementation pattern — creates the interface lib (schema, DTO, abstract service) and the core lib (entity, controller, module). Use when asked to add a new domain service or resource to the monorepo.
---

## Context

Read before acting:
- `standards/ARCHITECTURE.md` — interface/core split, schema-first types, service declaration pattern
- `standards/CODING_STANDARDS.md` — naming conventions

Replace `Widget`/`widget` with the actual resource name throughout.

---

## 1. Interface lib — `libs/<domain>/interface/src/lib/`

**Schema and types** — `<resource>.schema.ts`
```typescript
import { object, string, number, optional, array } from '@svx/common';
import type { InferObject } from '@svx/common';

export const WidgetSchema = object({
  id:   optional(number()),
  name: string().min(1).max(100),
}, "Widget");                          // name must be unique across the codebase

export type Widget = InferObject<typeof WidgetSchema>;

export const CreateWidgetSchema = object({
  name: string().min(1).max(100),
}, "CreateWidget");

export type CreateWidget = InferObject<typeof CreateWidgetSchema>;
```

**DTO** — `<resource>.dto.ts`
```typescript
import { Reflectable, Implements } from '@svx/common';
import { WidgetSchema, type Widget } from './widget.schema';

@Reflectable()
@Implements(WidgetSchema)
export class WidgetDto implements Widget {
  id?: number;
  name!: string;
}
```

**Abstract service** — `<resource>.service.ts`
```typescript
import { DeclareService, Service } from '@svx/service-common';
import type { Widget, CreateWidget } from './widget.schema';

@DeclareService()
export abstract class WidgetService extends Service {
  abstract findAll(): Promise<Widget[]>;
  abstract findOne(id: number): Promise<Widget>;
  abstract create(dto: CreateWidget): Promise<Widget>;
  abstract update(dto: Widget): Promise<Widget>;
  abstract delete(id: number): Promise<void>;
}
```

**Component declaration** — `<domain>.component.ts`
```typescript
import { Component, DeclareComponent } from '@svx/service-common';
import { WidgetService } from './widget.service';

@DeclareComponent({ name: 'widget-component', services: [WidgetService] })
export abstract class WidgetComponent extends Component {}
```

---

## 2. Core lib — `libs/<domain>/core/src/lib/`

**Entity** — `entity/<resource>.entity.ts`
```typescript
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { Reflectable } from '@svx/common';

@Reflectable() @Entity()
export class WidgetEntity {
  @PrimaryGeneratedColumn() id!: number;
  @Column() name!: string;
}
```

**Controller** — `<resource>.service.ts`
```typescript
import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import { Implementation } from '@svx/service-nestjs';
import { Mapper, mapping } from '@svx/core';
import { WidgetDto, WidgetService } from '@svx/widget-interface';
import type { Widget, CreateWidget } from '@svx/widget-interface';
import { WidgetEntity } from './entity/widget.entity';

@Implementation()
@Controller('widgets')
export class WidgetServiceController extends WidgetService {
  private readonly mapper: Mapper;

  constructor(@InjectRepository(WidgetEntity) private repo: Repository<WidgetEntity>) {
    super();
    this.mapper = new Mapper(
      mapping(WidgetEntity, WidgetDto, map => { map.matching(); }),
    );
  }

  @Get('all') @Transactional()
  async findAll(): Promise<WidgetDto[]> {
    return this.mapper.mapList(await this.repo.find());
  }

  @Get('find/:id') @Transactional()
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<WidgetDto> {
    return this.mapper.map(await this.repo.findOneOrFail({ where: { id } }));
  }

  @Post('create') @Transactional()
  async create(@Body() dto: CreateWidget): Promise<WidgetDto> {
    const entity = this.mapper.map(dto as WidgetDto, { direction: 'reverse' });
    return this.mapper.map(await this.repo.save(entity));
  }

  @Put('update') @Transactional()
  async update(@Body() dto: Widget): Promise<WidgetDto> {
    const entity = await this.repo.findOneOrFail({ where: { id: dto.id! } });
    this.mapper.map(dto as WidgetDto, { target: entity, direction: 'reverse' });
    return this.mapper.map(await this.repo.save(entity));
  }

  @Delete('delete/:id') @Transactional()
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
```

**Module** — `<domain>.module.ts`
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComponentModule, DefaultAddressResolution, LocalComponentDiscovery } from '@svx/service-nestjs';
import { WidgetComponent } from '@svx/widget-interface';
import { WidgetEntity } from './entity/widget.entity';

import './widget.service'; // side-effect import registers @Implementation()

@Module({
  imports: [
    ComponentModule.forRoot({
      components: [WidgetComponent],
      discovery: LocalComponentDiscovery,
      addressResolution: new DefaultAddressResolution('local', 'rest'),
      imports: [TypeOrmModule.forFeature([WidgetEntity])],
    }),
  ],
})
export class WidgetModule {}
```

---

## 3. Wire into the app

- Add `WidgetEntity` to the TypeORM `entities` array in `apps/api`
- Import `WidgetModule` in the app module

---

## Checklist

- [ ] Schema name (second arg to `object()`) is globally unique
- [ ] DTO has `@Reflectable()` and `@Implements(Schema)`
- [ ] Abstract service has `@DeclareService()` and extends `Service`
- [ ] Controller has `@Implementation()` and extends the abstract service
- [ ] Entity has `@Reflectable()` (required for mapper field reflection)
- [ ] All DB operations wrapped in `@Transactional()`
- [ ] `interface/` has zero NestJS or TypeORM imports
- [ ] Only `interface/` is imported by other services, never `core/`
