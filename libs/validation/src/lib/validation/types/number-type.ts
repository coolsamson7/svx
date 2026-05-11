import { Type, TypeInfo } from "../type"


/**
 * this constraint class adds specific checks for numbers.
 */
export class NumberType extends Type<NumberType, number> {
    // static

    static SINGLETON = new NumberType()

    // constructor

    constructor(name?: string) {
        super(name)

        this.literalType("number")
    }

    // fluent api

    min(min: number, info?: TypeInfo): NumberType {
        return this.test({
            type: "number",
            name: "min",
            params: {
                min: min,
            },
            ...info,
            check(object: number): boolean {
                return object >= min
            },
        })
    }

    max(max: number, info?: TypeInfo): NumberType {
        return this.test({
            type: "number",
            name: "max",
            params: {
                max: max,
            },
            ...info,
            check(object: number): boolean {
                return object <= max
            },
        })
    }

    lessThan(number: number, info?: TypeInfo): NumberType {
        return this.test({
            type: "number",
            name: "lessThan",
            params: {
                number: number,
            },
            ...info,
            check(object: number): boolean {
                return object < number
            },
        })
    }

    lessThanEquals(number: number, info?: TypeInfo): NumberType {
        return this.test({
            type: "number",
            name: "lessThanEquals",
            params: {
                number: number,
            },
            ...info,
            check(object: number): boolean {
                return object <= number
            },
        })
    }

    greaterThan(number: number, info?: TypeInfo): NumberType {
        return this.test({
            type: "number",
            name: "greaterThan",
            params: {
                number: number,
            },
            ...info,
            check(object: number): boolean {
                return object > number
            },
        })
    }

    greaterThanEquals(number: number, info?: TypeInfo): NumberType {
        return this.test({
            type: "number",
            name: "greaterThanEquals",
            params: {
                number: number,
            },
            ...info,
            check(object: number): boolean {
                return object >= number
            },
        })
    }

    override format(format: string, info?: TypeInfo): NumberType {
        return this.test({
            type: "number",
            name: "format",
            params: {
                format: format,
            },
            ...info,
            check(object: number): boolean {
                return true // TODO add...
            },
        })
    }

    precision(precision: number, info?: TypeInfo): NumberType {
        return this.test({
            type: "number",
            name: "precision",
            params: {
               precision: precision,
            },
            ...info,
            check(object: number): boolean {
                return true // TODO add...
            },
        })
    }

    scale(scale: number, info?: TypeInfo): NumberType {
        return this.test({
            type: "number",
            name: "scale",
            params: {
                scale: scale,
            },
            ...info,
            check(object: number): boolean {
                return true // TODO add...
            },
        })
    }

    //

    private scaleAndPrecision(value: number) {
        const x = value.toString();

        const scale = x.indexOf('.');
        if (scale == -1)
          return {
            scale: 0,
            precision: x.length
          };
        else
          return {
            scale: scale,
            precision: x.length - scale - 1
          };
    }

    // protected

    override safe(): NumberType {
        return this === NumberType.SINGLETON ? new NumberType() : this;
    }
}

// more

export class ShortType extends NumberType {
    // static

    static override SINGLETON = new ShortType()

    // constructor

    constructor(name?: string) {
        super(name)
    }

    // protected

    override safe(): ShortType {
        return this === ShortType.SINGLETON ? new ShortType() : this;
    }
}

export class IntegerType extends NumberType {
    // static

    static override SINGLETON = new IntegerType()

    // constructor

    constructor(name?: string) {
        super(name)
    }

    // protected

    override safe(): IntegerType {
        return this === IntegerType.SINGLETON ? new IntegerType() : this;
    }
}

export class LongType extends NumberType {
    // static

    static override SINGLETON = new LongType()

    // constructor

    constructor(name?: string) {
        super(name)
    }

    // protected

    override safe(): LongType {
        return this === LongType.SINGLETON ? new LongType() : this;
    }
}

export class FloatType extends NumberType {
    // static

    static override SINGLETON = new FloatType()

    // constructor

    constructor(name?: string) {
        super(name)
    }

    // protected

    override safe(): FloatType {
        return this === FloatType.SINGLETON ? new FloatType() : this;
    }
}

export class DoubleType extends NumberType {
    // static

    static override SINGLETON = new DoubleType()

    // constructor

    constructor(name?: string) {
        super(name)
    }

    // protected

    override safe(): DoubleType {
        return this === DoubleType.SINGLETON ? new DoubleType() : this;
    }
}

// functions

export const number = (name?: string) => name ? new NumberType(name) : NumberType.SINGLETON
export const short = (name?: string) => name ? new ShortType(name) : ShortType.SINGLETON
export const integer = (name?: string) => name ? new IntegerType(name) : IntegerType.SINGLETON
export const long = (name?: string) => name ? new LongType(name) : LongType.SINGLETON
export const float = (name?: string) => name ? new FloatType(name) : FloatType.SINGLETON
export const double = (name?: string) => name ? new DoubleType(name) : DoubleType.SINGLETON
