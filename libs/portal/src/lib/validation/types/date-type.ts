import { Type, TypeInfo } from "../type"

/**
 * this constraint class adds specific checks for dates.
 */
export class DateType extends Type<DateType, Date> {
    // constructor

    constructor(name?: string) {
        super(name)

        this.test({
            type: "date",
            name: "type",
            params: {
                type: "date",
            },
            break: true,
            check(object: Date): boolean {
                return typeof object == "object" && object.constructor.name === "Date"
            },
        })
    }

    // fluent

    min(min: Date, info?: TypeInfo): DateType {
        this.test({
            type: "number",
            name: "min",
            params: {
                min: min,
            },
            ...info,
            check(object: Date): boolean {
                return object >= min
            },
        })

        return this
    }

    max(max: Date, info?: TypeInfo): DateType {
        this.test({
            type: "number",
            name: "max",
            params: {
                max: max,
            },
            ...info,
            check(object: Date): boolean {
                return object <= max
            },
        })

        return this
    }

    override format(format: string, info?: TypeInfo): DateType {
        this.test({
            type: "date",
            name: "format",
            params: {
                format: format,
            },
            ...info,
            check(object: Date): boolean {
                return true // TODO add...
            },
        })

        return this
    }
}

export const date = (name?: string) => new DateType(name)
