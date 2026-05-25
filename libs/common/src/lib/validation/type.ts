

import { ObjectType } from "./types";
import { get, set } from '../lang';
import { StringBuilder } from '../util';


export interface ConstraintInfo {
    message?: string
}

class Patch {
  // data

  object: any;
  property: string;

  constructor(object: any, property: string, private evaluate: () => any) {
    this.object = object;
    this.property = property;
  }

  // public

  resolve(): void {
    this.set(this.evaluate());
  }

  // private

  private set(value: any): void {
    this.object[this.property] = value;
  }
}

export class ValidationContext {
    violations: TypeViolation[] = []
    path = ""
}

/**
 * A <code>Test</code> is a low-level test that is executed by a {@link Constraint}
 * @param T the base type
 */
export interface Test<T> {
    /**
     * the name of the parent constraint ( e.g. "string" )
     */
    type: string
    /**
     * the name of the test ( e.g. "min" )
     */
    name: string
    /**
     * any parameters that specify the test arguments
     */
    params: any
    /**
     * optional message that will be used on a violation
     */
    message?: string
    /**
     * if <code>true</code> the test chain will stop since the missing tests rely on this test result and will fail for sure
     */
    break?: boolean
    /**
     * if <code>true</code> a negative test result will not issue a violation
     */
    ignore?: boolean

    /**
     * the test implementation
     * @param object the to be validated object
     */
    check(object: T): boolean
}

export type TypeViolation = {
    /**
     * the type name
     */
    type: string
    /**
     * the constraint name
     */
    name: string
    /**
     * any parameters of the constraint
     */
    params: any
    /**
     * the value
     */
    value: any
    /**
     * the path
     */
    path: string
    /**
     * optional message
     */
    message?: string
}

export class ValidationError extends Error {
    constructor(public violations: TypeViolation[]) {
        super("validation error")
    }
}

export class Type<T extends Type<T, V>, V=any>  {
    // static data

    static cache = {}
    private static patches: Patch[] = [];
    private static timeout = false

    // static methods

    static register(constraint: Type<any,any>) {
        set(this.cache, constraint.name!, constraint)

        return this
    }

    static get(type: string): Type<any,any> | undefined {
        // execute possible pending patches

        this.resolve()

        // is it cached?

        return type.split('.').reduce((acc: any, key: string) => {

            if (acc === undefined) {
                return get<Type<any,any>>(this.cache, key)
            }

            const obj = acc as ObjectType;

            return obj.shape?.[key];

        }, undefined as any);
    }

    private static resolve() {
        let patch;
        while ((patch = this.patches.shift()))
            patch.resolve();

        this.timeout = false
    }

    static patch(object: any, property: string, evaluate: () => any) {
        this.patches.push(new Patch(object, property, evaluate))

        if ( !this.timeout) {
            this.timeout = true
            setTimeout(() => {this.resolve()}, 0)
        }
    }

    // instance data

    baseType = "string"
    _format = ""
    _description?: string
    inner?: Type<any, any>
    tests: Test<V>[] = []
    message?: string

    // constructor

    protected constructor(public name?: string) {
        if ( name )
            Type.register(this)
    }

    // protected

    safe(): T {
        return this as unknown as T
    }

    protected literalType(type: string) {
        this.baseType = type

        this.test({
            type: type,
            name: "type",
            params: {
                type: type,
            },
            break: true,
            check(object: any): boolean {
                return typeof object == type
            },
        })
    }


    // public

    description(text: string): T {
        const self = this.safe()
        self._description = text
        return self
    }

    format(format: string): T {
        const self = this.safe()

        self._format = format

        return self
    }

    validate(object: V) {
        const context = new ValidationContext()
        this.check(object, context)

        if (context.violations.length > 0)
            throw new ValidationError(context.violations)
    }

    isValid(object: V): boolean {
        const context = new ValidationContext()
        this.check(object, context)

        return context.violations.length == 0
    }

    // fluent: not here!

    errorMessage(message: string) : T {
        const self = this.safe()

        self.message = message

        return self
    }

    test(test: Test<V>): T {
        const self = this.safe()

        self.tests.push(test)

        return self
    }

    required(): T {
        const self = this.safe()

        const typeTest = self.tests[0]

        typeTest.ignore = false

        return self
    }

    nullable(): T {
        const self = this.safe()

        const typeTest = self.tests[0]

        typeTest.ignore = true

        return self
    }

    params4(constraint: string): any | undefined {
        for (const test of this.tests)
            if (test.name === constraint)
                return test.params

        return undefined
    }

    // public

    check(object: V, context: ValidationContext) {
        for (const test of this.tests) {
            if (!test.check(object)) {
                // remember violation

                if (test.ignore !== true)
                    context.violations.push({
                        type: test.type,
                        name: test.name,
                        params: test.params,
                        path: context.path,
                        value: object,
                        message: test.message,
                    })

                if (test.break === true) return
            }
        }
    }

     // override

    toString() : string {
        const builder = new StringBuilder()

        builder.append(this.baseType).append(" ")

        for ( const test of this.tests) {
            if ( test.name !== "type") {
                builder.append(test.name)

                if ( test.params ) {
                    for ( const key of Object.keys(test.params)) {
                        builder.append(" ")
                        builder.append(key)
                        builder.append("=")
                        builder.append(test.params[key])
                    }
                } // if
            }
        }

        return builder.toString()
    }
}

export const schema = (name: string, type: Type<any,any>) : Type<any,any> => {
    type.name = name

    Type.register(type);

    return type;
}
