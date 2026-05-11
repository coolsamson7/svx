import { Type, TypeInfo } from "../type"

/**
 * this constraint class adds specific checks for strings.
 */
export class StringType extends Type<StringType, string> {
    // static data

    static SINGLETON = new StringType()

    private static readonly EMAIL =
        /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

    // constructor

    constructor(name?: string) {
        super(name)

        this.literalType("string")
    }

    override safe(): StringType {
        return this === StringType.SINGLETON ? new StringType() : this;
    }

    // fluent api

    length(length: number, info?: TypeInfo): StringType {
        return this.test({
            type: "string",
            name: "length",
            params: {
                length: length,
            },
            ...info,
            check(object: string): boolean {
                return object.length === length
            },
        })
    }

    min(min: number, info?: TypeInfo): StringType {
        return this.test({
            type: "string",
            name: "min",
            params: {
                min: min,
            },
            ...info,
            check(object: string): boolean {
                return object.length >= min
            },
        })
    }

    max(max: number, info?: TypeInfo): StringType {
        return this.test({
            type: "string",
            name: "max",
            params: {
                max: max,
            },
            ...info,
            check(object: string): boolean {
                return object.length <= max
            },
        })
    }

    nonEmpty(info?: TypeInfo): StringType {
        return this.test({
            type: "string",
            name: "nonEmpty",
            params: {},
            ...info,
            check(object: string): boolean {
                return object.trim().length > 0
            },
        })
    }

    email(info?: TypeInfo): StringType {
        return this.test({
            type: "string",
            name: "email",
            params: {},
            ...info,
            check(object: string): boolean {
                return object.search(StringType.EMAIL) !== -1
            },
        })
    }

    matches(re: RegExp, info?: TypeInfo): StringType {
        return this.test({
            type: "string",
            name: "matches",
            params: {
                re: re,
            },
            ...info,
            check(object: string): boolean {
                return object.search(re) !== -1
            },
        })
    }

    override format(format: string, info?: TypeInfo): StringType {
        return this.test({
            type: "string",
            name: "format",
            params: {
                format: format,
            },
            ...info,
            check(object: string): boolean {
                return true // TODO add...
            },
        })
    }
}

export const string = (name?: string) => name ? new StringType(name) : StringType.SINGLETON
