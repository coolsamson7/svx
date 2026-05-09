/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import "reflect-metadata";
import { TraceLevel, Tracer } from "../tracer"
import { StringBuilder } from "../util"
import { GType } from "../lang"
import { ReflectedClass, ReflectorOutput} from "./reflector.interface";

/* =========================================================
 * INTERNAL METADATA KEYS
 * ========================================================= */

const ELEMENT_TYPE_KEY = Symbol("elementType")

/* =========================================================
 * DECORATORS
 * ========================================================= */

export function ElementType(type: Function) {
    return function (target: any, property: string) {
        Reflect.defineMetadata(ELEMENT_TYPE_KEY, type, target, property)

        // also register into descriptor (important for runtime usage)
        TypeDescriptor
            .forType(target.constructor)
            .addPropertyDecorator(target, property, ElementType, type)
    }
}

// optional alias (nicer DX)
export const ArrayOf = ElementType

/* =========================================================
 * PROPERTY SYSTEM
 * ========================================================= */

enum PropertyType {
    FIELD,
    CONSTRUCTOR,
    METHOD,
}

export interface DecoratorDescriptor {
    decorator: Function
    arguments: any[]
}

export abstract class PropertyDescriptor {
    public decorators: DecoratorDescriptor[] = []

    protected constructor(public name: string, public type: PropertyType) {}

    addDecorator(decorator: Function, args: any[]) {
        this.decorators.push({ decorator, arguments: args })
    }

    hasDecorator(decorator: Function): boolean {
        return this.decorators.some(spec => spec.decorator === decorator)
    }

    getDecorator(decorator: Function): DecoratorDescriptor | undefined {
        return this.decorators.find(spec => spec.decorator === decorator)
    }

    mergeDecoratorsFrom(parent: PropertyDescriptor) {
        for (const parentDec of parent.decorators) {
            if (!this.decorators.some(d => d.decorator === parentDec.decorator)) {
                this.decorators.push(parentDec)
            }
        }
    }

    abstract report(builder: StringBuilder): void
}

/* =========================================================
 * METHOD DESCRIPTOR
 * ========================================================= */

export class MethodDescriptor extends PropertyDescriptor {
    public async = false

    get paramTypes(): any[] {
        if (this.type === PropertyType.CONSTRUCTOR) {
            return Reflect.getMetadata('design:paramtypes', this.owner) || []
        }
        return Reflect.getMetadata(
            'design:paramtypes',
            this.owner.prototype,
            this.name
        ) || []
    }

    get returnType(): any {
        if (this.type === PropertyType.CONSTRUCTOR) {
            return this.owner
        }
        return Reflect.getMetadata(
            'design:returntype',
            this.owner.prototype,
            this.name
        )
    }

    constructor(
        name: string,
        public method: Function,
        type: PropertyType,
        private owner: GType<any>
    ) {
        super(name, type)
        this.async = method.constructor.name === 'AsyncFunction'
    }

    report(builder: StringBuilder): void {
        for (const spec of this.decorators)
            builder.append("\t@").append(spec.decorator.name).append("()\n")

        builder
            .append("\t")
            .append(this.async ? "async " : "")
            .append(this.name)
            .append("(")
            .append(this.paramTypes.map(p => p?.name ?? 'any').join(', '))
            .append(")")

        if (this.returnType) builder.append(": ").append(this.returnType.name)

        builder.append("\n")
    }
}

/* =========================================================
 * FIELD DESCRIPTOR (UPDATED)
 * ========================================================= */

export class FieldDescriptor extends PropertyDescriptor {
    public propertyType: any

    // 🔥 NEW: element type support
    public elementType?: any

    constructor(name: string) {
        super(name, PropertyType.FIELD)
    }

    isArray(): boolean {
        return this.propertyType === Array
    }

    isSet(): boolean {
        return this.propertyType === Set
    }

    getElementType(): any | undefined {
        return this.elementType
    }

    report(builder: StringBuilder): void {
        for (const decorator of this.decorators)
            builder.append("\t@").append(decorator.decorator.name).append("()\n")

        builder.append("\t").append(this.name)

        if (this.propertyType) {
            builder.append(": ").append(this.propertyType.name)

            // show generic info if available
            if (this.elementType) {
                builder.append("<").append(this.elementType.name).append(">")
            }
        }

        builder.append("\n")
    }
}

/* =========================================================
 * TYPE DESCRIPTOR
 * ========================================================= */

export interface Decorator<T = any> {
    decorate(type: TypeDescriptor<T>, instance: T): void
}

export class TypeDescriptor<T> {
   private static reflected = new Map<string, ReflectedClass>()

   static loadReflection(data: ReflectorOutput) {
       for (const cls of data.classes) {
           TypeDescriptor.reflected.set(cls.name, cls)
       }
   }

    static forType<T>(type: GType<T>): TypeDescriptor<T> {
        const proto = type.prototype as any
        if (!Object.prototype.hasOwnProperty.call(proto, '__descriptor')) {
            proto.__descriptor = new TypeDescriptor<T>(type)
        }
        return proto.__descriptor
    }

    public parent?: TypeDescriptor<any>
    public decorators: DecoratorDescriptor[] = []
    private properties: Record<string, PropertyDescriptor> = {}

    private constructor(public type: GType<T>) {
        if (Tracer.ENABLED)
            Tracer.Trace("type", TraceLevel.HIGH, "create type descriptor for {0}", type.name)

        const parentProto = Object.getPrototypeOf(type.prototype)
        if (parentProto && parentProto.constructor !== Object) {
            this.parent = TypeDescriptor.forType(parentProto.constructor)
        }

        this.analyzeStructure(type)
        this.loadReflectedMethods()
        this.inheritFromParent()
    }

  private loadReflectedMethods() {
      const reflected =
          TypeDescriptor.reflected.get(this.type.name)

      if (!reflected)
          return

      for (const reflectedMethod of reflected.methods) {

          // already discovered at runtime
          if (this.properties[reflectedMethod.name])
              continue

          // synthetic placeholder function
          const synthetic = async function () {}

          const descriptor = new MethodDescriptor(
              reflectedMethod.name,
              synthetic,
              PropertyType.METHOD,
              this.type
          )

          // restore decorators
          for (const decorator of reflectedMethod.decorators) {
              descriptor.addDecorator(
                  { name: decorator.name } as any,
                  decorator.arguments
              )
          }

          this.properties[reflectedMethod.name] = descriptor
      }
  }

    public create(...args: any[]): T {
        return new this.type(...args)
    }

    /* =========================================================
     * DECORATORS
     * ========================================================= */

    public addDecorator(decorator: Function, ...args: any[]): this {
        this.decorators.push({ decorator, arguments: args })
        return this
    }

    public hasDecorator(decorator: Function): boolean {
        return this.decorators.some(d => d.decorator === decorator)
    }

    public getDecorator(decorator: Function): DecoratorDescriptor | undefined {
        return this.decorators.find(d => d.decorator === decorator)
    }

    public addMethodDecorator(target: any, property: string, decorator: Function, ...args: any[]): this {
        let method = this.getMethod(property)
        if (!method) {
            const desc = Object.getOwnPropertyDescriptor(target, property)
            if (desc && typeof desc.value === 'function') {
                method = new MethodDescriptor(property, desc.value, PropertyType.METHOD, target.constructor)
                this.properties[property] = method
            }
        }
        if (method) method.addDecorator(decorator, args)
        return this
    }

    public addPropertyDecorator(target: any, property: string, decorator: Function, ...args: any[]): this {
        let descriptor = this.getField(property)
        if (!descriptor) {
            descriptor = new FieldDescriptor(property)
            this.properties[property] = descriptor
            descriptor.propertyType = Reflect.getMetadata('design:type', target, property)
        }

        descriptor.addDecorator(decorator, args)

        // 🔥 capture element type
        if (decorator === ElementType) {
            descriptor.elementType = args[0]
        }

        return this
    }

    /* =========================================================
     * ACCESSORS
     * ========================================================= */

    public getConstructor(): MethodDescriptor {
        return this.properties['constructor'] as MethodDescriptor
    }

    public getMethods(filter: (method: MethodDescriptor) => boolean = () => true): MethodDescriptor[] {
        return Object.values(this.properties)
            .filter((p): p is MethodDescriptor => p.type === PropertyType.METHOD)
            .filter(filter)
    }

    public getFields(filter: (field: FieldDescriptor) => boolean = () => true): FieldDescriptor[] {
        return Object.values(this.properties)
            .filter((p): p is FieldDescriptor => p.type === PropertyType.FIELD)
            .filter(filter)
    }

    public getField(name: string): FieldDescriptor | undefined {
        const p = this.properties[name]
        return p instanceof FieldDescriptor ? p : undefined
    }

    public getMethod(name: string): MethodDescriptor | undefined {
        const p = this.properties[name]
        return p instanceof MethodDescriptor ? p : undefined
    }

    /* =========================================================
     * ANALYSIS
     * ========================================================= */

    private analyzeStructure(type: GType<T>) {
        this.properties['constructor'] =
            new MethodDescriptor('constructor', type, PropertyType.CONSTRUCTOR, type)

        let proto = type.prototype

        while (proto && proto !== Object.prototype) {
            const descriptors = Object.getOwnPropertyDescriptors(proto)

            for (const key of Object.keys(descriptors)) {
                if (key === 'constructor') continue

                const desc = descriptors[key]

                if (typeof desc.value === 'function') {
                    if (!this.properties[key]) {
                        this.properties[key] = new MethodDescriptor(
                            key,
                            desc.value,
                            PropertyType.METHOD,
                            proto.constructor as GType<any>
                        )
                    }
                } else {
                    if (!this.properties[key]) {
                        const fieldDesc = new FieldDescriptor(key)

                        fieldDesc.propertyType =
                            Reflect.getMetadata('design:type', proto, key)

                        // 🔥 read element type metadata
                        const elementType =
                            Reflect.getMetadata(ELEMENT_TYPE_KEY, proto, key)

                        if (elementType) {
                            fieldDesc.elementType = elementType
                        }

                        this.properties[key] = fieldDesc
                    }
                }
            }

            proto = Object.getPrototypeOf(proto)
        }
    }

    private inheritFromParent() {
        if (!this.parent) return

        for (const key of Object.keys(this.properties)) {
            const childProp = this.properties[key]
            const parentProp = this.parent.properties[key]

            if (childProp && parentProp) {
                childProp.mergeDecoratorsFrom(parentProp)
            }
        }
    }

    /* =========================================================
     * DEBUG
     * ========================================================= */

    public toString(): string {
        const builder = new StringBuilder()

        for (const decorator of this.decorators)
            builder.append("@").append(decorator.decorator.name).append("()\n")

        builder.append("class ").append(this.type.name).append(" {\n")

        for (const field of this.getFields())
            field.report(builder)

        for (const method of this.getMethods())
            method.report(builder)

        builder.append("}\n")

        return builder.toString()
    }
}
