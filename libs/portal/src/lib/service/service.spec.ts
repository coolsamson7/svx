import "reflect-metadata";
import {
  Module,
  Injectable,
  Inject,
  Controller,
  Post,
  Param,
  Body,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { TypeDescriptor } from "../reflection"

import { Component, InjectService, createComponentModule } from "./service"

const method = function (): any {
    return (target: any, property: string, _descriptor: PropertyDescriptor) => {
        TypeDescriptor.forType(target.constructor).addMethodDecorator(target, property, method)
    }
}

/* ============================================================
   🧩 1. SHARED CONTRACTS
============================================================ */

export class ServiceA {
  @method()
  foo!: () => Promise<string>;
}

export abstract class ServiceB {
  @method()
  bar!: (x: number) => Promise<number>;
}

/* ============================================================
   🌐 2. REMOTE CONTROLLERS (SERVER SIDE)
============================================================ */

@Controller("ServiceA")
class ServiceAController extends ServiceA {
  @Post("foo")
  async foo() : Promise<string> {
    return "hello-from-remote";
  }
}

@Controller("ServiceB")
class ServiceBController extends ServiceB {
  @Post("foo")
  override async foo(@Body() args: any[]) : Promise<number> {
    const [x] = args;
    return x * 2;
  }
}

@Module({
  controllers: [ServiceAController, ServiceBController],
})
class RemoteAppModule {}

/* ============================================================
   🧠 3. CLIENT SIDE INFRA (YOUR ARCHITECTURE)
============================================================ */

/* ============================================================
   🧩 4. COMPONENT (CLIENT CONFIG)
============================================================ */

@Component({
  services: [ServiceA, ServiceB],
  endpoint: "http://localhost:4000",
})
class RemoteComponent {}

/* ============================================================
   💉 5. CLIENT SERVICE
============================================================ */

@Injectable()
class AppService {
  constructor(
    @InjectService(ServiceA) private a: ServiceA,
    @InjectService(ServiceB) private b: ServiceB
  ) {}

  async run() {
    const resA = await this.a.foo();
    const resB = await this.b.foo(21);

    return { resA, resB };
  }
}

@Module({
  imports: [createComponentModule(RemoteComponent)],
  providers: [AppService],
})
class ClientAppModule {}


describe("Remote Component (E2E)", () => {
  let remoteApp: any;
  let clientApp: any;
  let appService: AppService;

  beforeAll(async () => {
    // start remote server
    remoteApp = await NestFactory.create(RemoteAppModule);
    await remoteApp.listen(4000);

    // start client DI container
    clientApp = await NestFactory.createApplicationContext(
      ClientAppModule
    );

    appService = clientApp.get(AppService);
  });

  afterAll(async () => {
    await remoteApp.close();
    await clientApp.close();
  });

  it("should call remote services via proxy", async () => {
    const result = await appService.run();

    expect(result).toEqual({
      resA: "hello-from-remote",
      resB: 42,
    });
  });
});
