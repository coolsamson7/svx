import 'reflect-metadata';

import { Injectable } from '@nestjs/common';

import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Component,
  DeclareComponent,
  Implementation,
  Service,
  ChannelAddress,
  ChannelFactory,
  ComponentRegistry,
  DeclareService,
  ComponentModule,
  DeclareChannel,
  Channel,
  ServiceDescriptor,
} from './service';


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

@DeclareChannel('http')
@Injectable({ scope: Scope.TRANSIENT })
export class HttpChannel implements Channel {

  async call(descriptor: ServiceDescriptor, method: string, ...args: any[]) {
    /*const res = await fetch(`${this.uri}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return res.json();*/
    return undefined
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

    moduleRef = await Test.createTestingModule({
      imports: [ComponentModule.forModule(UserComponent)],
      providers: [ChannelFactory],
    }).compile();

    // retrieve the proxy for the abstract service

    componentRegistry = moduleRef.get(ComponentRegistry);

    await componentRegistry.createInstances(); // manually trigger module init to setup services ?????
  });

  it('should return a proxy instance', async () => {
    const userService = componentRegistry.getService<UserService>(UserService);

    const result = await userService.createUser('Alice');

    expect(result).toBe('user-Alice');
  });
});
