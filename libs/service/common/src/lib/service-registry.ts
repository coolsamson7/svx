/* eslint-disable @typescript-eslint/no-explicit-any */
import { TypeDescriptor, StringBuilder } from "@svx/common"
import { AbstractType, Component, ComponentDeclaration, ComponentDescriptor, ComponentOptions, Service, ServiceDeclaration, ServiceDescriptor, ServiceOptions } from "./service-common"

export class ServiceRegistry {
    // static data

    static readonly componentDeclarations:    ComponentDeclaration[]    = []
    static readonly serviceDeclarations:      ServiceDeclaration[]      = []
    //static readonly serviceImplementations:   AbstractType<Service>[]   = []

    static instance : ServiceRegistry;

    // static methods

    static declareComponent(target: AbstractType<Component>, options: ComponentOptions): void {
      ServiceRegistry.componentDeclarations.push({ name: options.name ?? target.name, type: target, options })
    }

    static declareService(target: AbstractType<Service>, options: ServiceOptions): void {
      ServiceRegistry.serviceDeclarations.push({ name: options.name ?? target.name, type: target, options })
    }

    // instance data

    private components = new Map<string, ComponentDescriptor<Component>>();
    private services = new Map<string, ServiceDescriptor<Service>>();
    private byType =  new Map<AbstractType<Service>, ServiceDescriptor>();

    // constructor

    constructor() {
      this.setup()

      ServiceRegistry.instance = this
    }

    // public

    findComponentByName(name: string): ComponentDescriptor<Component> | undefined {
      return this.components.get(name)
    }

    findServiceDescriptor<T extends Service>(type: AbstractType<T>): ServiceDescriptor<T> {
      let current = type;

      while (
        current &&
        current !== Function.prototype &&
        //current !== Object &&
        current !== Object.prototype
      ) {
        const descriptor = this.byType.get(current);

        if (descriptor) {
          return descriptor as ServiceDescriptor<T>;
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

export function DeclareService(options: ServiceOptions = {}): ClassDecorator {
    return (target: any) => {
      TypeDescriptor.forType(target).addDecorator(DeclareService, options)
      ServiceRegistry.declareService(target, {
        name: options.name ?? target.name,
      })
    }
  }

  export function DeclareComponent(options: ComponentOptions): ClassDecorator {
    return (target: any) => {
      TypeDescriptor.forType(target).addDecorator(DeclareComponent, options)
      ServiceRegistry.declareComponent(target, options)
    }
  }
