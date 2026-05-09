import 'reflect-metadata';

import { Injectable, Scope, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { describe, it, expect, beforeEach } from 'vitest';


import {
  Component,
  DeclareComponent,
  Implementation,
  Service,
  ChannelAddress,
  ComponentRegistry,
  DeclareService,
  ComponentModule
} from './service';

import "./http.channel"
import { TypeDescriptor } from '../reflection';

import reflection from './service.json'
TypeDescriptor.loadReflection(reflection)

// interface

@DeclareService({ name: "user-service" })
export abstract class UserService extends Service {
  abstract createUser(name: string): Promise<string>;
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
      new ChannelAddress('http', 'http://localhost:3000'), // remote
    ];
  }
}

@Injectable()
@Implementation()
export class UserServiceImpl extends UserService {
  async createUser(name: string): Promise<string> {
    return `user-${name}`;
  }
}

/* =========================================
   Client
=========================================

@Injectable()
export class ClientService {
  constructor(
    @Inject(UserServiceInterface) private userSvc: UserServiceInterface,
  ) {}
  async run() {
    const id = await this.userSvc.createUser('Alice');
    console.log('Got user id:', id);
  }
}*/

// TES

//import { Test, TestingModule } from '@nestjs/testing';


describe('Service', () => {
  let moduleRef: TestingModule;

  let app: INestApplication;

  let componentRegistry: ComponentRegistry;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ComponentModule.forModule(UserComponent),
      ],
    }).compile();

  componentRegistry = moduleRef.get(ComponentRegistry);

  await componentRegistry.createInstances();

  app = moduleRef.createNestApplication();

  await app.init();

  console.log(componentRegistry.report());
  });

  afterEach(async () => {
    await app.close();
  });

  it('should return a proxy instance', async () => {
    const userService = componentRegistry.getService<UserService>(UserService);

    const result = await userService.createUser('Alice');

    expect(result).toBe('user-Alice');
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
