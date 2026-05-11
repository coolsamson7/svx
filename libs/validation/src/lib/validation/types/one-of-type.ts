import { Type } from "../type"

/**
 * Validation type for literal union types (e.g., 'value1' | 'value2' | 'value3')
 * This is different from EnumType which expects an enum object at runtime.
 */
export class OneOfType<T> extends Type< OneOfType<T>, T> {
    // constructor

    constructor(private allowedValues: T[], name?: string) {
        super(name)

        this.test({
            type: "oneOf",
            name: "type",
            params: {
                values: allowedValues,
            },
            break: true,
            check(object: T): boolean {
                return allowedValues.includes(object)
            },
        })
    }
}

/**
 * Creates a validation type for a union of literal values
 * Usage: oneOf('count', 'sum', 'avg')
 */
export const oneOf = <T>(...values: T[]) => new OneOfType<T>(values)
