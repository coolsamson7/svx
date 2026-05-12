import { ChannelAddress } from "@svx/service-common";
import { Implementation } from "@svx/service-nestjs";
import { Injectable } from "@nestjs/common";
import { UserComponent } from '@svx/user-interface';


@Injectable()
@Implementation()
export class UserComponentImpl extends UserComponent {
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
