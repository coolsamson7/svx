import 'reflect-metadata';

import { Injectable, INestApplication, Controller, Put, Get, Post, Delete, Patch, Param, Query, Body } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';


import {
  Implementation,
  ComponentRegistry,
  ComponentModule,
  LocalComponentDiscovery,
  DefaultAddressResolution,
  AbstractNestComponent,
} from '@svx/service-nestjs';

import { DeclareService, DeclareComponent, Service, ChannelAddress, ABSTRACT } from "@svx/service-common"

import "./http.channel"
import "./rest.channel"

import { ModulesContainer } from '@nestjs/core';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';

function printRoutes(app: INestApplication) {
  const modules = app.get(ModulesContainer);

  for (const module of modules.values()) {
    for (const controller of module.controllers.values()) {
      const instance = controller.instance;
      if (!instance) continue;

      const controllerPath =
        Reflect.getMetadata(PATH_METADATA, instance.constructor) ?? '';

      const prototype = Object.getPrototypeOf(instance);

      for (const methodName of Object.getOwnPropertyNames(prototype)) {
        if (methodName === 'constructor') continue;

        const handler = prototype[methodName];

        const routePath =
          Reflect.getMetadata(PATH_METADATA, handler);

        const requestMethod: RequestMethod =
          Reflect.getMetadata(METHOD_METADATA, handler);

        if (routePath !== undefined) {
          console.log(
            `${RequestMethod[requestMethod]} /${controllerPath}/${routePath}`
              .replace(/\/+/g, '/')
          );
        }
      }
    }
  }
}

// ─── DTOs ───────────────────────────────────────────────────────────────────

export class CreateUserDto {
  name!: string;
  email!: string;
}

export class User {
  id!: string;
  name!: string;
  email!: string;
}

// ─── Service interface ───────────────────────────────────────────────────────

@DeclareService({ name: "user-service" })
export abstract class UserService extends Service {
  /** PUT /user/:name — path param */
  createUser(name: string): Promise<string> { return ABSTRACT() }

  /** GET /user/search?q=… — query param */
  searchUsers(q: string): Promise<string[]> { return ABSTRACT() }

  /** GET /user/filter?minAge=…&maxAge=… — multiple query params */
  filterUsers(minAge: number, maxAge: number): Promise<string[]> { return ABSTRACT() }

  /** POST /user — request body */
  createUserWithBody(dto: CreateUserDto): Promise<User> { return ABSTRACT() }

  /** DELETE /user/:id — path param, no body */
  deleteUser(id: string): Promise<boolean> { return ABSTRACT() }

  /** PATCH /user/:id — path param + body */
  updateUser(id: string, dto: CreateUserDto): Promise<User> { return ABSTRACT() }
}

@DeclareComponent({ name: "user-component", services: [UserService] })
export abstract class UserComponent extends AbstractNestComponent {}

// ─── Implementation ──────────────────────────────────────────────────────────

@Injectable()
@Implementation()
@Controller('user-component')
export class UserComponentImpl extends UserComponent {
  async startup() {}
  async shutdown() {}

  get addresses(): ChannelAddress[] {
    return [
      new ChannelAddress('rest', 'http://localhost:3001'),
      new ChannelAddress('http', 'http://localhost:3001'),
    ];
  }
}

@Injectable()
@Implementation()
@Controller("user")
export class UserServiceImpl extends UserService {

  @Put(":name")
  async createUser(@Param("name") name: string): Promise<string> {
    return `user-${name}`;
  }

  @Get("search")
  async searchUsers(@Query("q") q: string): Promise<string[]> {
    return [`result-for-${q}`];
  }

  @Get("filter")
  async filterUsers(
    @Query("minAge") minAge: number,
    @Query("maxAge") maxAge: number,
  ): Promise<string[]> {
    return [`users-${minAge}-${maxAge}`];
  }

  @Post()
  async createUserWithBody(@Body() dto: CreateUserDto): Promise<User> {
    return { id: "1", name: dto.name, email: dto.email };
  }

  @Delete(":id")
  async deleteUser(@Param("id") id: string): Promise<boolean> {
    return id !== "nonexistent";
  }

  @Patch(":id")
  async updateUser(
    @Param("id") id: string,
    @Body() dto: CreateUserDto,
  ): Promise<User> {
    return { id, name: dto.name, email: dto.email };
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Service', () => {
  let moduleRef: TestingModule;
  let app: INestApplication;
  let componentRegistry: ComponentRegistry;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ComponentModule.forRoot({
          components: [UserComponent],
          discovery: LocalComponentDiscovery,
          addressResolution: new DefaultAddressResolution("clocal", "rest")
        }),
      ],
      controllers: [UserServiceImpl, UserComponentImpl],
      providers: [UserComponentImpl, UserServiceImpl],
    }).compile();

    componentRegistry = moduleRef.get(ComponentRegistry);
    app = moduleRef.createNestApplication();
    await app.init();
    printRoutes(app);
    await app.listen(3001);
    console.log(componentRegistry.report());
  });

  afterAll(async () => {
    await app.close();
  });

  it('PUT /:name — path param', async () => {
    const svc = componentRegistry.getService<UserService>(UserService);
    const result = await svc.createUser('Alice');
    expect(result).toBe('user-Alice');
  });

  it('GET /search?q= — single query param', async () => {
    const svc = componentRegistry.getService<UserService>(UserService);
    const result = await svc.searchUsers('bob');
    expect(result).toEqual(['result-for-bob']);
  });

  it('GET /filter?minAge=&maxAge= — multiple query params', async () => {
    const svc = componentRegistry.getService<UserService>(UserService);
    const result = await svc.filterUsers(18, 65);
    expect(result).toEqual(['users-18-65']);
  });

  it('POST / — request body', async () => {
    const svc = componentRegistry.getService<UserService>(UserService);
    const dto: CreateUserDto = { name: 'Carol', email: 'carol@example.com' };
    const result = await svc.createUserWithBody(dto);
    expect(result).toMatchObject({ id: '1', name: 'Carol', email: 'carol@example.com' });
  });

  it('DELETE /:id — path param', async () => {
    const svc = componentRegistry.getService<UserService>(UserService);
    expect(await svc.deleteUser('42')).toBe(true);
    expect(await svc.deleteUser('nonexistent')).toBe(false);
  });

  it('PATCH /:id — path param + body', async () => {
    const svc = componentRegistry.getService<UserService>(UserService);
    const dto: CreateUserDto = { name: 'Dave', email: 'dave@example.com' };
    const result = await svc.updateUser('99', dto);
    expect(result).toMatchObject({ id: '99', name: 'Dave', email: 'dave@example.com' });
  });

  it('benchmark: PUT /:name — 10k calls', async () => {
    const svc = componentRegistry.getService<UserService>(UserService);
    await svc.createUser('Alice'); // warm up

    const runs = 10000;
    const start = performance.now();
    for (let i = 0; i < runs; i++) await svc.createUser('Alice');
    const end = performance.now();

    const totalMs  = end - start;
    const opsPerSec = (runs / totalMs) * 1000;
    const avgMs    = totalMs / runs;

    console.log(`
  Benchmark: createUser
  ─────────────────────
  Runs:       ${runs.toLocaleString()}
  Total:      ${totalMs.toFixed(2)} ms
  Avg/op:     ${avgMs.toFixed(6)} ms
  Throughput: ${opsPerSec.toLocaleString(undefined, { maximumFractionDigits: 0 })} ops/sec
    `);
  });
});
