import { Type, ValidationContext} from "../type"
import { OptionalType } from "./optional-type"

export type PropertyConstraints = { 
    [property: string]: Type<any> 
}

/**
 * this constraint class adds specific checks for complex objects.
 */
export class ObjectType<T = any> extends Type<ObjectType<T>, T> {
    // constructor

    constructor(public shape: PropertyConstraints, name?: string) {
        super(name)

        this.baseType = "object"

        // add possible patches

        for ( const property in shape)
            if (typeof shape[property] == "string" )
                Type.patch(shape, property, () => Type.get(shape[property] as any as string))

        // add test

        this.test({
            type: "object",
            name: "type",
            params: {
                type: "object",
            },
            break: true,
            check(object: T): boolean {
                return typeof object == "object"
            },
        })
    }

    // override constraint

    override check(object: T, context: ValidationContext) {
        // super will check the object

        super.check(object, context)

        // check properties

        if (object !== undefined) {
            const path = context.path

            // check all properties

            for (const property in this.shape) {
                context.path = path === "" ? property : path + "." + property;

                const hasProp = Object.hasOwn(object!, property)
                const value = hasProp ? (object as any)[property] : undefined
                const type = this.shape[property] as Type<any>

                if (!hasProp) {
                     if (type instanceof OptionalType)
                        continue
                    
                    const test = type.tests[0]

                    context.violations.push({
                        type: test.type,
                        name: test.name,
                        params: test.params,
                        path: context.path,
                        value: object,
                        message: "is required",
                    });
                }
                else
                    type.check(value, context)
            } // for

            context.path = path
        }
    }
}

type InferType<T extends Type<any, any>> =
  T extends Type<any, infer V> ? V : never;
  
export type InferObject<T extends ObjectType<any>> =
  T extends ObjectType<infer S>
    ? S
    : never;

export type InferShape<T extends PropertyConstraints> = {
    [K in keyof T]: T[K] extends Type<any, infer V> ? V : never
  }

  export const object = <T extends PropertyConstraints>(
    constraints: T,
    name?: string
  ): ObjectType<InferShape<T>> =>
    new ObjectType<InferShape<T>>(constraints, name)