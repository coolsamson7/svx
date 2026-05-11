/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { TraceLevel, Tracer } from "../tracer"
import { StringBuilder } from "../util"
import { GType } from "../lang"
import { ReflectedClass, ReflectorOutput } from "./reflector.interface";

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
        TypeDescriptor
            .forType(target.constructor)
            .addPropertyDecorator(target, property, ElementType, type)
    }
}

export const ArrayOf = ElementType

export function Returns(type: any) {
    return function (target: any, key: string | symbol, _descriptor: PropertyDescriptor) {
        TypeDescriptor
            .forType(target.constructor)
            .addMethodDecorator(target, key as string, Returns, type);
    };
}

export const Field = (): any => {
    return function (target: any, propertyKey: string) {
        TypeDescriptor.forType(target.constructor).addPropertyDecorator(target, propertyKey, Field)
    }
}

export function Method(): any {
  return (target: any, property: string) => {
    TypeDescriptor.forType(target.constructor).addMethodDecorator(target, property, Method)
  };
}

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
 * PARAMETER DESCRIPTOR
 * ========================================================= */

export class ParameterDescriptor {
    public decorators: DecoratorDescriptor[] = []

    constructor(
        public index:     number,
        public name:      string,
        public paramType: any,          // runtime type from design:paramtypes or JSON type string
    ) {}

    addDecorator(decorator: Function, args: any[]) {
        this.decorators.push({ decorator, arguments: args })
    }

    hasDecorator(decorator: Function): boolean {
        return this.decorators.some(d => d.decorator === decorator)
    }

    getDecorator(decorator: Function): DecoratorDescriptor | undefined {
        return this.decorators.find(d => d.decorator === decorator)
    }

    mergeDecoratorsFrom(parent: ParameterDescriptor) {
        for (const parentDec of parent.decorators) {
            if (!this.decorators.some(d => d.decorator === parentDec.decorator))
                this.decorators.push(parentDec)
        }
    }

    report(builder: StringBuilder): void {
        const decorators = this.decorators
            .map(d => `@${d.decorator.name}(${d.arguments.join(', ')})`)
            .join(' ')

        const typeName = typeof this.paramType === 'string'
            ? this.paramType                          // from JSON: "string", "number", etc.
            : this.paramType?.name ?? 'any'           // from reflect-metadata: actual type

        builder
            .append(decorators ? `${decorators} ` : '')
            .append(this.name)
            .append(': ')
            .append(typeName)
    }
}

/* =========================================================
 * METHOD DESCRIPTOR
 * ========================================================= */

export class MethodDescriptor extends PropertyDescriptor {
    public async      = false
    public parameters: ParameterDescriptor[] = []   // ← proper typed array, not (method as any)

    get paramTypes(): any[] {
        if (this.type === PropertyType.CONSTRUCTOR)
            return Reflect.getMetadata('design:paramtypes', this.owner) || []

        return Reflect.getMetadata('design:paramtypes', this.owner.prototype, this.name) || []
    }

    get returnType(): any {
        if (this.type === PropertyType.CONSTRUCTOR)
            return this.owner

        return Reflect.getMetadata('design:returntype', this.owner.prototype, this.name)
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

    // -------------------------------------------------------
    // Build ParameterDescriptors from reflect-metadata.
    // Called after construction when runtime types are available.
    // JSON-loaded methods get their parameters from loadReflectionFromJSON.
    // -------------------------------------------------------
    buildParametersFromMetadata(): void {
        if (this.parameters.length > 0) return   // already populated (e.g. from JSON)

        const types = this.paramTypes
        types.forEach((paramType, index) => {
            this.parameters.push(new ParameterDescriptor(index, `arg${index}`, paramType))
        })
    }

    getParameter(index: number): ParameterDescriptor | undefined {
        return this.parameters.find(p => p.index === index)
    }

    report(builder: StringBuilder): void {
        for (const spec of this.decorators)
            builder.append("\t@").append(spec.decorator.name).append("()\n")

        builder
            .append("\t")
            .append(this.async ? "async " : "")
            .append(this.name)
            .append("(")

        this.parameters.forEach((p, i) => {
            if (i > 0) builder.append(", ")
            p.report(builder)
        })

        // fallback to paramTypes if no ParameterDescriptors yet
        if (this.parameters.length === 0)
            builder.append(this.paramTypes.map(p => p?.name ?? 'any').join(', '))

        builder.append(")")

        if (this.returnType) builder.append(": ").append(this.returnType.name)

        builder.append("\n")
    }
}

/* =========================================================
 * FIELD DESCRIPTOR
 * ========================================================= */

export class FieldDescriptor extends PropertyDescriptor {
    public propertyType: any
    public elementType?: any

    constructor(name: string) {
        super(name, PropertyType.FIELD)
    }

    isArray(): boolean  { return this.propertyType === Array }
    isSet():   boolean  { return this.propertyType === Set }
    getElementType(): any | undefined { return this.elementType }

    report(builder: StringBuilder): void {
        for (const decorator of this.decorators)
            builder.append("\t@").append(decorator.decorator.name).append("()\n")

        builder.append("\t").append(this.name)

        if (this.propertyType) {
            builder.append(": ").append(this.propertyType.name)
            if (this.elementType)
                builder.append("<").append(this.elementType.name).append(">")
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
    private static reflected  = new Map<string, ReflectedClass>()
    private static instances  = new Map<string, TypeDescriptor<any>>()

    static loadReflection(data: ReflectorOutput) {
        for (const cls of data.classes)
            TypeDescriptor.reflected.set(cls.name, cls)
    }

    // -------------------------------------------------------
    // Merge method decorators + parameters from child class
    // up into parent class reflected data, then patch live instance.
    // -------------------------------------------------------
    /*static mergeChildDecorators(childName: string, parentName?: string): void {
        const child = TypeDescriptor.reflected.get(childName)
        if (!child) throw new Error(`No reflected data for '${childName}'`)

        const targetName = parentName ?? child.superClass
        if (!targetName) throw new Error(`'${childName}' has no superClass in reflected data`)

        let parent = TypeDescriptor.reflected.get(targetName)
        if (!parent) {
            parent = { name: targetName, decorators: [], methods: [] }
            TypeDescriptor.reflected.set(targetName, parent)
        }

        for (const childMethod of child.methods) {
            let parentMethod = parent.methods.find(m => m.name === childMethod.name)
            if (!parentMethod) {
                parentMethod = { name: childMethod.name, decorators: [], parameters: [] }
                parent.methods.push(parentMethod)
            }

            for (const dec of childMethod.decorators)
                if (!parentMethod.decorators.some(d => d.name === dec.name))
                    parentMethod.decorators.push(dec)

            for (const childParam of childMethod.parameters) {
                let parentParam = parentMethod.parameters.find(p => p.name === childParam.name)
                if (!parentParam) {
                    parentParam = { name: childParam.name, type: childParam.type, decorators: [] }
                    parentMethod.parameters.push(parentParam)
                }
                for (const dec of childParam.decorators)
                    if (!parentParam.decorators.some(d => d.name === dec.name))
                        parentParam.decorators.push(dec)
            }
        }

        // patch live descriptor if already constructed
        TypeDescriptor.instances.get(targetName)?.patchFromReflected()
    }*/

    static forType<T>(type: GType<T>): TypeDescriptor<T> {
        const proto = type.prototype as any
        if (!Object.prototype.hasOwnProperty.call(proto, '__descriptor')) {
            const desc = new TypeDescriptor<T>(type)
            proto.__descriptor = desc
            desc.init()
            TypeDescriptor.instances.set(type.name, desc)
        }
        return proto.__descriptor
    }

    public parent?:     TypeDescriptor<any>
    public decorators:  DecoratorDescriptor[] = []
    private properties: Record<string, PropertyDescriptor> = {}

    private constructor(public type: GType<T>) {}

    public init() {
        if (Tracer.ENABLED)
            Tracer.Trace("type", TraceLevel.HIGH, "create type descriptor for {0}", this.type.name)

        const parentProto = Object.getPrototypeOf(this.type.prototype)
        if (parentProto && parentProto.constructor !== Object)
            this.parent = TypeDescriptor.forType(parentProto.constructor)

        this.analyzeStructure(this.type)
        this.loadReflectionFromJSON()
        this.inheritFromParent()
    }

    // -------------------------------------------------------
    // Load / patch from JSON reflected data.
    // Idempotent — skips already-present entries.
    // -------------------------------------------------------
    patchFromReflected(): void {
        this.loadReflectionFromJSON()
    }

    private loadReflectionFromJSON(): void {
        const reflected = TypeDescriptor.reflected.get(this.type.name)
        if (!reflected) return

        // ── class decorators ──────────────────────────────
        for (const d of reflected.decorators) {
            if (!this.decorators.some(ex => ex.decorator.name === d.name))
                this.decorators.push({ decorator: { name: d.name } as any, arguments: d.arguments })
        }

        // ── methods ───────────────────────────────────────
        for (const m of reflected.methods) {
            let method = this.getMethod(m.name)

            if (!method) {
                const synthetic = async function() {}
                method = new MethodDescriptor(m.name, synthetic, PropertyType.METHOD, this.type)
                this.properties[m.name] = method
            }

            // merge method-level decorators
            for (const d of m.decorators) {
                if (!method.decorators.some(ex => ex.decorator.name === d.name))
                    method.addDecorator({ name: d.name } as any, d.arguments)
            }

            // ── parameters: build ParameterDescriptors from JSON ──
            // JSON has: { name, type, decorators[] } — index = array position
            m.parameters.forEach((p, position) => {
                const index = (p as any).index ?? position

                let param = method!.getParameter(index)
                if (!param) {
                    // paramType: prefer runtime type from paramTypes[], fall back to JSON type string
                    const runtimeType = method!.paramTypes[index]
                    param = new ParameterDescriptor(index, p.name, runtimeType ?? p.type)
                    method!.parameters.push(param)
                }

                // merge parameter decorators
                for (const d of p.decorators) {
                    if (!param.decorators.some(ex => ex.decorator.name === d.name))
                        param.addDecorator({ name: d.name } as any, d.arguments)
                }
            })

            // ensure parameters are sorted by index
            method.parameters.sort((a, b) => a.index - b.index)
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
        if (decorator === ElementType)
            descriptor.elementType = args[0]
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
                        const method = new MethodDescriptor(
                            key, desc.value, PropertyType.METHOD, proto.constructor as GType<any>
                        )
                        // build ParameterDescriptors from reflect-metadata right away
                        method.buildParametersFromMetadata()
                        this.properties[key] = method
                    }
                } else {
                    if (!this.properties[key]) {
                        const fieldDesc = new FieldDescriptor(key)
                        fieldDesc.propertyType = Reflect.getMetadata('design:type', proto, key)
                        const elementType = Reflect.getMetadata(ELEMENT_TYPE_KEY, proto, key)
                        if (elementType) fieldDesc.elementType = elementType
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
            const childProp  = this.properties[key]
            const parentProp = this.parent.properties[key]

            if (childProp && parentProp) {
                childProp.mergeDecoratorsFrom(parentProp)

                // also merge parameter descriptors for methods
                if (childProp instanceof MethodDescriptor && parentProp instanceof MethodDescriptor) {
                    for (const parentParam of parentProp.parameters) {
                        const childParam = childProp.getParameter(parentParam.index)
                        if (childParam) childParam.mergeDecoratorsFrom(parentParam)
                        else childProp.parameters.push(parentParam)
                    }
                }
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
