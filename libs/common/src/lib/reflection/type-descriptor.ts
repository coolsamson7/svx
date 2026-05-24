/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/// <reference types="reflect-metadata" />

import { TraceLevel, Tracer } from "../tracer"
import { StringBuilder } from "../util"
import { GType } from "../lang"
import { getImplementors, getImplementingSchema } from "./implements"
import { Type } from "../validation/type"

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
 * TYPE INFO
 * ========================================================= */

export class TypeInfo {
    constructor(
        public readonly source: any,
        public readonly typeArgs?: TypeInfo[]
    ) {}

    // Resolves to implementing class when source is a schema instance (plain object).
    // Falls back to source itself for constructors and built-ins.
    get type(): any {
        if (this.source !== null && this.source !== undefined && typeof this.source === 'object')
            return getImplementors(this.source)[0] ?? this.source
        return this.source
    }

    get elementType(): any | undefined { return this.typeArgs?.[0]?.type }
    isArray(): boolean { return this.source === Array }
    isSet():   boolean { return this.source === Set }
}

/* =========================================================
 * PARAMETER DESCRIPTOR
 * ========================================================= */

export class ParameterDescriptor {
    public decorators: DecoratorDescriptor[] = []

    constructor(
        public index:     number,
        public name:      string,
        public paramType: TypeInfo,
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

        builder
            .append(decorators ? `${decorators} ` : '')
            .append(this.name)
            .append(': ')
            .append(this.paramType.type?.name ?? 'any')
    }
}

/* =========================================================
 * METHOD DESCRIPTOR
 * ========================================================= */

export class MethodDescriptor extends PropertyDescriptor {
    public async      = false
    public parameters: ParameterDescriptor[] = []
    public returnType?: TypeInfo
    private paramsFilled = false

    get paramTypes(): any[] {
        if (!this.paramsFilled) this.buildParametersFromMetadata()
        return this.parameters.map(p => p.paramType.type)
    }

    get elementType(): any | undefined {
        if (!this.returnType) return undefined
        let ti: TypeInfo | undefined = this.returnType
        if (ti.type === Promise) ti = ti.typeArgs?.[0]
        if (!ti) return undefined
        if (ti.type === Array) return ti.typeArgs?.[0]?.type
        return ti === this.returnType ? undefined : ti.type
    }

    constructor(
        name: string,
        public method: Function,
        type: PropertyType,
        private owner: GType<any>
    ) {
        super(name, type)
        this.async = method.constructor.name === 'AsyncFunction'
        const rt = type === PropertyType.CONSTRUCTOR
            ? owner
            : Reflect.getMetadata('design:returntype', owner.prototype, name)
        if (rt) this.returnType = new TypeInfo(rt)
    }

    buildParametersFromMetadata(): void {
        if (this.paramsFilled) return
        this.paramsFilled = true
        if (this.parameters.length > 0) return

        const types: any[] = this.type === PropertyType.CONSTRUCTOR
            ? Reflect.getMetadata('design:paramtypes', this.owner) || []
            : Reflect.getMetadata('design:paramtypes', this.owner.prototype, this.name) || []

        types.forEach((paramType: any, index: number) => {
            this.parameters.push(new ParameterDescriptor(index, `arg${index}`, new TypeInfo(paramType)))
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

        builder.append(")")

        if (this.returnType) builder.append(": ").append(this.returnType.type?.name ?? 'void')

        builder.append("\n")
    }
}

/* =========================================================
 * FIELD DESCRIPTOR
 * ========================================================= */

export interface TypeRef {
    t: () => any
    a?: TypeRef[]
}

function typeRefToTypeInfo(ref: TypeRef): TypeInfo {
    return new TypeInfo(ref.t(), ref.a?.map(typeRefToTypeInfo))
}

export class FieldDescriptor extends PropertyDescriptor {
    public fieldType: TypeInfo
    public constraint?: any

    constructor(name: string, type?: any) {
        super(name, PropertyType.FIELD)
        this.fieldType = new TypeInfo(type)
    }

    isArray(): boolean  { return this.fieldType?.isArray() ?? false }
    isSet():   boolean  { return this.fieldType?.isSet() ?? false }
    getElementType(): any | undefined { return this.fieldType?.elementType }

    report(builder: StringBuilder): void {
        for (const decorator of this.decorators)
            builder.append("\t@").append(decorator.decorator.name).append("()\n")

        builder.append("\t").append(this.name)

        if (this.fieldType?.type) {
            builder.append(": ").append(this.fieldType.type.name)
            if (this.fieldType.elementType)
                builder.append("<").append(this.fieldType.elementType.name).append(">")
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

/* =========================================================
 * Schema type → TypeInfo conversion (duck-typed)
 * ========================================================= */

function schemaTypeToTypeInfo(st: any): TypeInfo {
    if (!st) return new TypeInfo(Object)
    // OptionalType — has .inner
    if (st.inner !== undefined)
        return schemaTypeToTypeInfo(st.inner)
    // ArrayType — has .element
    if (st.element !== undefined)
        return new TypeInfo(Array, [schemaTypeToTypeInfo(st.element)])
    // Primitives / ObjectType via baseType
    switch (st.baseType) {
        case 'string':  return new TypeInfo(String)
        case 'number':  return new TypeInfo(Number)
        case 'boolean': return new TypeInfo(Boolean)
        case 'object':  return new TypeInfo(st)   // ObjectType — resolves to class via TypeInfo.type
        default:        return new TypeInfo(Object)
    }
}

export class TypeDescriptor<T> {
    private static instances  = new Map<string, TypeDescriptor<any>>()

    static fromSchema<T = any>(schema: any): TypeDescriptor<T> {
        const name = schema?.name as string | undefined
        if (name) {
            const cached = TypeDescriptor.instances.get(name)
            if (cached) return cached
        }

        const desc = new TypeDescriptor<T>(schema)   // schema acts as the identity token
        desc._isSchema = true
        if (name) TypeDescriptor.instances.set(name, desc)

        const shape = schema?.shape as Record<string, any> | undefined
        if (shape)
            for (const [fieldName, fieldType] of Object.entries(shape)) {
                const fd = new FieldDescriptor(fieldName)
                fd.fieldType = schemaTypeToTypeInfo(fieldType)
                fd.constraint = fieldType
                desc.properties[fieldName] = fd
            }

        return desc
    }

    static forType<T>(type: GType<T> | any): TypeDescriptor<T> {
        // String name — look up in Type registry directly.
        if (typeof type === 'string') {
            const cached = TypeDescriptor.instances.get(type)
            if (cached) return cached
            const schema = Type.get(type)
            if (!schema) throw new Error(`No type registered with name: "${type}"`)
            return TypeDescriptor.fromSchema(schema)
        }

        // Schema instance (non-function, e.g. ObjectType) — return schema descriptor.
        if (typeof type !== 'function')
            return TypeDescriptor.fromSchema(type)

        const proto = type.prototype as any
        if (!Object.prototype.hasOwnProperty.call(proto, '__descriptor')) {
            const desc = new TypeDescriptor<T>(type)
            proto.__descriptor = desc
            desc.init()
            TypeDescriptor.instances.set(type.name, desc)
            const schema = getImplementingSchema(type)
            if (schema) {
                const schemaTd = TypeDescriptor.fromSchema(schema)
                desc.implements = schemaTd
                schemaTd.implementations.push(desc)
                for (const sf of schemaTd.getFields()) {
                    const cf = desc.getField(sf.name)
                    if (cf) cf.constraint = sf.constraint
                }
            }
        }
        return proto.__descriptor
    }

    public parent?:          TypeDescriptor<any>
    public implements?:      TypeDescriptor<any>
    public implementations:  TypeDescriptor<any>[] = []
    public decorators:       DecoratorDescriptor[] = []
    private _isSchema        = false
    private properties:      Record<string, PropertyDescriptor> = {}

    private constructor(public type: GType<T>) {}

    public init() {
        if (this._isSchema) return

        if (Tracer.ENABLED)
            Tracer.Trace("type", TraceLevel.HIGH, "create type descriptor for {0}", this.type.name)

        const parentProto = Object.getPrototypeOf(this.type.prototype)
        if (parentProto && parentProto.constructor !== Object)
            this.parent = TypeDescriptor.forType(parentProto.constructor)

        this.analyzeStructure(this.type)
        this.loadFromStaticDescriptor()
        this.inheritFromParent()
    }

    private loadFromStaticDescriptor(): void {
        const desc = (this.type as any)._descriptor as {
            fields?: Array<{ name: string; ref: TypeRef; optional?: boolean }>
            methods?: Array<{ name: string; params: Array<{ name: string; ref: TypeRef }>; ret: TypeRef }>
        } | undefined
        if (!desc) return

        for (const f of desc.fields ?? []) {
            let field = this.getField(f.name)
            if (!field) {
                field = new FieldDescriptor(f.name)
                this.properties[f.name] = field
            }
            field.fieldType = typeRefToTypeInfo(f.ref)
        }

        for (const m of desc.methods ?? []) {
            let method = this.getMethod(m.name)
            if (!method) {
                method = new MethodDescriptor(m.name, function() {}, PropertyType.METHOD, this.type)
                this.properties[m.name] = method
            }
            method.parameters = m.params.map((p, i) =>
                new ParameterDescriptor(i, p.name, typeRefToTypeInfo(p.ref))
            )
            method.returnType = typeRefToTypeInfo(m.ret)
        }
    }

    public create(...args: any[]): T {
        if (this._isSchema) throw new Error(`Cannot instantiate schema descriptor "${(this.type as any)?.name}"`)
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
        if (method) {
            if (!method.returnType) {
                const rt = Reflect.getMetadata('design:returntype', target, property)
                if (rt) method.returnType = new TypeInfo(rt)
            }
            method.addDecorator(decorator, args)
        }
        return this
    }

    public addPropertyDecorator(target: any, property: string, decorator: Function, ...args: any[]): this {
        let descriptor = this.getField(property)
        if (!descriptor) {
            descriptor = new FieldDescriptor(property, Reflect.getMetadata('design:type', target, property))
            this.properties[property] = descriptor
        }
        descriptor.addDecorator(decorator, args)
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
                        this.properties[key] = method
                    }
                } else {
                    if (!this.properties[key])
                        this.properties[key] = new FieldDescriptor(key, Reflect.getMetadata('design:type', proto, key))
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
