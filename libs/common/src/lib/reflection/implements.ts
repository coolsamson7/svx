/// <reference types="reflect-metadata" />

import { Type } from '../validation/type'

const SCHEMA_KEY       = 'implements:schema'
const IMPLEMENTORS_KEY = 'implements:classes'

export function Implements(schema: any): ClassDecorator {
    return (constructor: Function) => {
        Reflect.defineMetadata(SCHEMA_KEY, schema, constructor)
        const list: Function[] = Reflect.getMetadata(IMPLEMENTORS_KEY, schema) ?? []
        list.push(constructor)
        Reflect.defineMetadata(IMPLEMENTORS_KEY, list, schema)
    }
}

export function getImplementingSchema(ctor: Function): any | undefined {
    return Reflect.getMetadata(SCHEMA_KEY, ctor)
}

export function getImplementors(schema: any): Function[] {
    return Reflect.getMetadata(IMPLEMENTORS_KEY, schema) ?? []
}

export function resolveType(nameOrSchema: string | any): Function {
    const schema = typeof nameOrSchema === 'string' ? Type.get(nameOrSchema) : nameOrSchema
    if (!schema) return Object
    return getImplementors(schema)[0] ?? Object
}
