/* eslint-disable @typescript-eslint/no-explicit-any */

import { StringBuilder } from '@svx/common';

export type AbstractType<T> = abstract new (...args: any[]) => T;

export class Service {}

export abstract class Component extends Service {
  abstract startup(): Promise<void>;
  abstract shutdown(): Promise<void>;
  abstract get addresses(): ChannelAddress[];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async channelMetadata(_channel: string, _descriptor?: ComponentDescriptor<any>): Promise<any> { return undefined }
}

export class ChannelAddress {
  constructor(
    public channel: string,
    public uri: string,
  ) {}
}

export interface Channel {
  url?: string;
  call(descriptor: ServiceDescriptor, method: string, ...args: any[]): Promise<any>;
}

export interface ChannelFactory<T extends Channel=Channel> {
  create(url: string) : T
  metadataFor?(descriptor: ComponentDescriptor<any>): Promise<any> | any
}

export abstract class CachingChannelFactory<T extends Channel> implements ChannelFactory<T> {
  // instance data

  channels = new Map<string, T>()

  // asbtract

  abstract createChannel(url: string) : T;

  // implement

  create(url: string) : T {
    let channel = this.channels.get(url)
    if (!channel ) {
      this.channels.set(url, channel = this.createChannel(url))
    }

    return channel
  }
}

export interface ServiceOptions {
  name?: string
}

export interface ComponentOptions extends ServiceOptions {
  services: AbstractType<Service>[];
}

/* =========================================
   Component Descriptor & Registry
========================================= */

export class Descriptor<T extends Service> {
  // instance data

  instance?: T

  // constructor

  constructor(public name: string, public type: AbstractType<T>) {}
}

export class ServiceDescriptor<T extends Service=Service> extends Descriptor<T> {
  // instance data

  componentDescriptor! : ComponentDescriptor<Component>

  // constructor

  constructor(public name: string, public type: AbstractType<T>) {
    super(name,  type)
  }

  report(builder: StringBuilder) {
    builder.append("\t").append(this.name)

    if ( this.instance )
      builder.append(" implemented by ").append(this.instance.constructor.name)
  }
}

export class ComponentDescriptor<T extends Component> extends ServiceDescriptor<T> {
  // instance data

  addresses: ChannelAddress[] = [];

  constructor(public name: string, public type: AbstractType<T>, public services: ServiceDescriptor[]) {
    super(name, type)

    // link

    for ( const service of services)
      service.componentDescriptor = this
  }

  // public

  report(builder: StringBuilder) {
    builder.append(this.name)
    if ( this.instance )
      builder.append(" implemented by ").append(this.instance.constructor.name)

    builder.append("\n")

    for ( const service of this.services)
      service.report(builder)
  }
}


export interface ComponentDeclaration {
  name: string
  type: AbstractType<Component>
  options: ComponentOptions
}


export interface ServiceDeclaration {
  name: string
  type: AbstractType<Service>
  options: ServiceOptions
}

export function ABSTRACT(): never {
  throw new Error('NYI');
}


