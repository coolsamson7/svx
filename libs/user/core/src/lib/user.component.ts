import { ChannelAddress } from "@svx/service-common";
import { Implementation, NestComponent } from "@svx/service-nestjs";
import { Controller, Injectable } from '@nestjs/common';
import { UserComponent } from '@svx/user-interface';


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

  get addresses(): ChannelAddress[] {
    return [
      new ChannelAddress('rest', 'http://localhost:3000'),
      new ChannelAddress('http', 'http://localhost:3000'),
    ];
  }
}
