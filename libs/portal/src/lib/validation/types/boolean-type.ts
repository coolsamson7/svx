import { Type, TypeInfo } from "../type"

/**
 * this constraint class adds specific checks for booleans.
 */
export class BooleanType extends Type<BooleanType, boolean> {
    // static

    static SINGLETON = new BooleanType()

    // constructor

    constructor(name?: string) {
        super(name)

        this.literalType("boolean")
    }

    // fluent

    isTrue(info?: TypeInfo): BooleanType {
        return this.test({
            type: "boolean",
            name: "isTrue",
            params: {},
            ...info,
            check(object: boolean): boolean {
                return object === true
            },
        })
    }

    isFalse(info?: TypeInfo): BooleanType {
        return this.test({
            type: "boolean",
            name: "isFalse",
            params: {},
            ...info,
            check(object: boolean): boolean {
                return object === false
            },
        })
    }

    // protected

    override safe(): BooleanType {
        return this === BooleanType.SINGLETON ? new BooleanType() : this;
    }
}

/**
 * return a new constraint based on boolean values
 */
export const boolean = (name?: string) => name ? new BooleanType(name) : BooleanType.SINGLETON
