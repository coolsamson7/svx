import 'reflect-metadata';

import { Injectable, INestApplication, Controller, Put, Param } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach } from 'vitest';


import {
  Implementation,
  ComponentRegistry,
  ComponentModule,
  LocalComponentDiscovery,
  DefaultAddressResolution
} from '@svx/service-nestjs';

import { Component, DeclareService, DeclareComponent,  Service, ChannelAddress, ABSTRACT } from "@svx/service-common"

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

import { RestChannel } from './rest.channel';

import proxies from './service-rest-proxies.json'
import { ProxySchema } from './rest.channel'
RestChannel.loadReflection(proxies as unknown as ProxySchema)

// interface

@DeclareService({ name: "user-service" })
export abstract class UserService extends Service {
  createUser(name: string): Promise<string> { return ABSTRACT() }
}

@DeclareComponent({ name: "user-component", services: [UserService] })
export abstract class UserComponent extends Component {}

// implementation

@Injectable()
@Implementation()
export class UserComponentImpl extends UserComponent {
  // implement

  async startup() {
    console.log("UserComponent starting up...");
  }

  async shutdown() {
    console.log("UserComponent shutting down...");
  }

  get addresses(): ChannelAddress[] {
    return [
      new ChannelAddress('rest', 'http://localhost:3000'),
      new ChannelAddress('http', 'http://localhost:3000'), // remote
      //new ChannelAddress('local'),
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
}

// TEST
describe('Service', () => {
  let moduleRef: TestingModule;

  let app: INestApplication;

  let componentRegistry: ComponentRegistry;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ComponentModule.forRoot({
          components: [UserComponent],
          discovery: LocalComponentDiscovery,
          addressResolution: new DefaultAddressResolution("clocal", "rest")
        }),
      ],
      controllers: [UserServiceImpl],
      providers: [UserComponentImpl, UserServiceImpl],
    }).compile();

  componentRegistry = moduleRef.get(ComponentRegistry);

  app = moduleRef.createNestApplication();

  await app.init();

  printRoutes(app);

  await app.listen(3000);

  console.log(componentRegistry.report());
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return a proxy instance', async () => {
    const userService = componentRegistry.getService<UserService>(UserService);

    await userService.createUser('Alice');

    const runs = 10000;

      const start = performance.now();

      for (let i = 0; i < runs; i++) {
        await userService.createUser('Alice');
      }

      const end = performance.now();

      const totalMs = end - start;
      const opsPerSec = (runs / totalMs) * 1000;
      const avgMs = totalMs / runs;

      console.log(`
    Benchmark: createUser
    ----------------------
    Runs:        ${runs.toLocaleString()}
    Total time:  ${totalMs.toFixed(2)} ms
    Avg/op:      ${avgMs.toFixed(6)} ms
    Throughput:  ${opsPerSec.toLocaleString(undefined, { maximumFractionDigits: 0 })} ops/sec
      `);
  });
/*
  it('should expose http endpoint', async () => {
    await request(app.getHttpServer())
      .post('/service')
      .send({
        service: 'user-service',
        method: 'createUser',
        args: ['Bob'],
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.result).toBe('user-Bob');
      });
  });*/
});
