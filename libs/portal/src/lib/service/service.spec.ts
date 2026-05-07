import { Injectable, Type } from '@nestjs/common';
import 'reflect-metadata';


import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Component,
  DeclareComponent,
  Implementation,
  Service,
  ChannelAddress,
  ChannelFactory,
  createComponentModule,
  ComponentRegistry,
  DeclareService,
} from './service';


// interface

@DeclareService({ name: "user-service" })
export abstract class UserService extends Service {
  abstract createUser(name: string): Promise<string>;
}

@DeclareComponent({ name: "user-component", services: [UserService as Type<any>] })
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

describe('Service', () => {
  let moduleRef: TestingModule;

  let componentRegistry: ComponentRegistry;


  beforeEach(async () => {
    // create a dynamic NestJS testing module
    moduleRef = await Test.createTestingModule({
      imports: [createComponentModule(UserComponent as any)],
      providers: [ChannelFactory], // ensure factory is available
    }).compile();

    // retrieve the proxy for the abstract service
    componentRegistry = moduleRef.get(ComponentRegistry);
    await componentRegistry.createInstances(); // manually trigger module init to setup services ?????
  });

  it('should return a proxy instance', () => {
    const userService = componentRegistry.getService<UserService>(UserService);

    const result = userService.createUser('Alice');

    expect(typeof userService.createUser).toBe('function');
  });
});
