import { ChannelAddress, Component, ComponentDescriptor, ServiceRegistry } from "@svx/service-common";
import { ChannelBuilder, ComponentRegistry, Implementation } from "@svx/service-nestjs";
import { Controller, Get, Inject, Injectable, Query } from '@nestjs/common';
import { UserComponent } from '@svx/user-interface';
import { Constructor } from "@svx/common";

type AbstractConstructor<T> = abstract new (...args: any[]) => T;


export function NestComponent<TBase extends AbstractConstructor<Component>>(Base: TBase) {
  abstract class Mixin extends Base {
    @Inject(ChannelBuilder)
    private channelBuilder!: ChannelBuilder;

    //@Inject(ServiceRegistry)
    //private serviceRegistry!: ServiceRegistry;

    constructor( ...args: any[]) {
      super(...args)
    }

    @Get('channel-metadata')
    async getChannelMetadata(@Query('channel') channel = 'rest') {
      const descriptor = ServiceRegistry.instance.findServiceDescriptor(this.constructor as any) as ComponentDescriptor<Component>;
      return this.channelBuilder.metadataFor(channel, descriptor);
    }
  }
  return Mixin;
}


@Injectable()
@Controller('user-component')
@Implementation()
export class UserComponentImpl extends NestComponent(UserComponent) {
  // implement

  async startup() {
    console.log("UserInventoryComponent starting up...");
  }

  async shutdown() {
    console.log("UserInventoryComponent shutting down...");
  }

  //@Get('channel-metadata')
  //async channelMetadata(channel: string, descriptor?: ComponentDescriptor<any>): Promise<any> {
  //    return this.channelBuilder.metadataFor(channel, descriptor ?? this.descriptor);
  //}

  get addresses(): ChannelAddress[] {
    return [
      new ChannelAddress('rest', 'http://localhost:3000'),
      new ChannelAddress('http', 'http://localhost:3000'),
    ];
  }
}
