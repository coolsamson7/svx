import { ChannelAddress, Component, DeclareComponent } from '@svx/service-common';
import { Implementation } from '@svx/service-nestjs';
import { Injectable } from '@nestjs/common';
import { UserInventoryService } from './user-inventory.service';

@DeclareComponent({ name: 'user-component', services: [UserInventoryService] })
export abstract class UserComponent extends Component {}

// implementation -> IMPL!

@Injectable()
@Implementation()
export class UserComponentImpl extends UserComponent {
  // implement

  async startup() {
    console.log('UserComponent starting up...');
  }

  async shutdown() {
    console.log('UserComponent shutting down...');
  }

  get addresses(): ChannelAddress[] {
    return [
      new ChannelAddress('http', 'http://localhost:3000'), // remote
    ];
  }
}
