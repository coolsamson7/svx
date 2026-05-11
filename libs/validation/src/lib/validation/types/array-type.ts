/* eslint-disable @typescript-eslint/no-explicit-any */
import { Type, TypeInfo, ValidationContext } from "../type"

/**
 * this constraint class adds specific checks for arrays.
 */
export class ArrayType<T> extends Type<ArrayType<T>, T[]> {
    // constructor

    constructor(public element: Type<any, T>) {
        super()

        this.test({
            type: "array",
            name: "type",
            params: {
                type: "array",
            },
            break: true,
            check(object: T[]): boolean {
                return Array.isArray(object)
            },
        })
    }

    // fluent

    min(min: number, info?: TypeInfo): ArrayType<T> {
        this.test({
            type: "array",
            name: "min",
            params: {
                min: min,
            },
            ...info,
            check(object: Array<T>): boolean {
                return object.length >= min
            },
        })

        return this
    }

    max(max: number, info?: TypeInfo): ArrayType<T> {
        this.test({
            type: "array",
            name: "max",
            params: {
                max: max,
            },
            ...info,
            check(object: T[]): boolean {
                return object.length <= max
            },
        })

        return this
    }

    // override constraint

    override check(object: T[], context: ValidationContext) {
        // super will check the object

        super.check(object, context)

        // check elements

        if (object !== undefined && this.element) {
            const path = context.path

            // check all properties

            let index = 0
            for (const element of object) {
                context.path = path + "[" + index + "]"

                this.element!.check(element, context)

                index++
            } // for

            context.path = path
        }
    }
}

export const array = <T>(constraint: Type<any, T>) => new ArrayType<T>(constraint)
