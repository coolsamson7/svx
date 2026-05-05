import { Type } from "../type"

/**
 * Union of multiple Type<T> validators.
 * Example: typeUnion(string(), number())
 */
export class TypeUnion<T> extends Type<any, T> {
    constructor(private readonly types: readonly Type<any>[], name?: string) {
        super(name)

        this.test({
            type: "union",
            name: "type",
            params: { types },
            break: true,
            check: (value: unknown) => types.some(t => t.isValid(value)),
        })
    }
}

/**
 * Creates a union of schema types.
 * Usage: typeUnion(string(), number())
 */
export const union = <A, B>(...types: readonly Type<any>[]) =>
    new TypeUnion<A | B>(types)
