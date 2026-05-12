import {
  Component,
  DeclareComponent,
} from '@svx/service-common';
import { UserInventoryService } from './user-inventory.service';

@DeclareComponent({ name: 'user-component', services: [UserInventoryService] })
export abstract class UserComponent extends Component {}
