/* eslint-disable @typescript-eslint/no-explicit-any */
import { TypeDescriptor } from '../reflection'
import { StringBuilder } from '../util';


export type AbstractType<T> = abstract new (...args: any[]) => T;

export class Service {}

export abstract class Component extends Service {
  abstract startup(): Promise<void>;
  abstract shutdown(): Promise<void>;
  abstract get addresses(): ChannelAddress[];
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


export interface ServiceOptions {
  name: string
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


interface ComponentDeclaration {
  name: string
  type: AbstractType<Component>
  options: ComponentOptions
}


interface ServiceDeclaration {
  name: string
  type: AbstractType<Service>
  options: ServiceOptions
}

// class

export class ServiceRegistry {
  static readonly componentDeclarations:    ComponentDeclaration[]    = []
  static readonly serviceDeclarations:      ServiceDeclaration[]      = []
  //static readonly serviceImplementations:   AbstractType<Service>[]   = []

  static declareComponent(target: AbstractType<Component>, options: ComponentOptions): void {
    ServiceRegistry.componentDeclarations.push({ name: options.name, type: target, options })
  }

  static declareService(target: AbstractType<Service>, options: ServiceOptions): void {
    ServiceRegistry.serviceDeclarations.push({ name: options.name, type: target, options })
  }

  /*static implementService(target: AbstractType<Service>): void {
    ServiceRegistry.serviceImplementations.push(target)
  }*/
}

/* =========================================================
 * Decorators — shared
 * Register into ServiceRegistry only — no framework coupling.
 * ========================================================= */

export function DeclareService(options: ServiceOptions): ClassDecorator {
  return (target: any) => {
    TypeDescriptor.forType(target).addDecorator(DeclareService, options)
    ServiceRegistry.declareService(target, options)
  }
}

export function DeclareComponent(options: ComponentOptions): ClassDecorator {
  return (target: any) => {
    TypeDescriptor.forType(target).addDecorator(DeclareComponent, options)
    ServiceRegistry.declareComponent(target, options)
  }
}

/*export function Implementation<T extends Service>(): ClassDecorator {
  return (target: any) => {
    ServiceRegistry.implementService(target)
  }
}*/
