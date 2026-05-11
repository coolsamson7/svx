import { ChannelAddress, Component, DeclareComponent } from "@svx/service-common";
import { Implementation } from "@svx/service-nestjs";
import { UserInventoryService } from "./user-inventory.service";
import { Injectable } from "@nestjs/common";


@DeclareComponent({ name: "user-component", services: [UserInventoryService] })
export abstract class UserInventoryComponent extends Component {}


@Injectable()
@Implementation()
export class UserInventoryComponentImpl extends UserInventoryComponent {
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
