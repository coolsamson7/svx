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
  // static data

  static readonly componentDeclarations:    ComponentDeclaration[]    = []
  static readonly serviceDeclarations:      ServiceDeclaration[]      = []
  //static readonly serviceImplementations:   AbstractType<Service>[]   = []

  // static methods

  static declareComponent(target: AbstractType<Component>, options: ComponentOptions): void {
    ServiceRegistry.componentDeclarations.push({ name: options.name, type: target, options })
  }

  static declareService(target: AbstractType<Service>, options: ServiceOptions): void {
    ServiceRegistry.serviceDeclarations.push({ name: options.name, type: target, options })
  }

  /*static implementService(target: AbstractType<Service>): void {
    ServiceRegistry.serviceImplementations.push(target)
  }*/

  // instance data

  private components = new Map<string, ComponentDescriptor<Component>>();
  private services = new Map<string, ServiceDescriptor<Service>>();
  private byType =  new Map<AbstractType<Service>, ServiceDescriptor>();

  // constructor

  constructor() {
    this.setup()
  }

  // public

  findServiceDescriptor(type: AbstractType<Service>): ServiceDescriptor {
    let current = type;

    while (
      current &&
      current !== Function.prototype &&
      current !== Object &&
      current !== Object.prototype
    ) {
      const descriptor = this.byType.get(current);

      if (descriptor) {
        return descriptor;
      }

      current = Object.getPrototypeOf(current);
    }

    throw new Error(`Unknown service ${type.name}`)
  }

  report() : string {
    const builder = new StringBuilder()

    builder.append("Components\n")

    for ( const component of this.components.values())
      component.report(builder)

    return builder.toString()
  }

  // private

  private registerService(serviceDescriptor: ServiceDescriptor<Service>) {
    this.byType.set(serviceDescriptor.type, serviceDescriptor)

    this.services.set(serviceDescriptor.name, serviceDescriptor)
  }

  private registerComponent(componentDescriptor: ComponentDescriptor<Component>) {
    this.byType.set(componentDescriptor.type, componentDescriptor)

    this.components.set(componentDescriptor.name, componentDescriptor)
  }

  private setup() {
    // services

    for (const declaration of ServiceRegistry.serviceDeclarations)
      this.registerService(new ServiceDescriptor(declaration.name, declaration.type))

    // components

    for (const declaration of ServiceRegistry.componentDeclarations)
      this.registerComponent(new ComponentDescriptor(declaration.name, declaration.type, declaration.options.services.map(type => this.byType.get(type) as ServiceDescriptor)))
  }

  // public
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