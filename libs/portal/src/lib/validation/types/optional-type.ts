import { Type, ValidationContext} from "../type"

export class OptionalType<T> extends Type<OptionalType<T>, T | undefined> {
    constructor(public inner: Type<OptionalType<T>, T>, name?: string) {
        super(name ?? "optional " + inner.name)
    }

    override check(object: T | undefined, context: ValidationContext) {
        // ✅ undefined → skip validation completely
        //if (object === undefined) return

        // delegate to inner type
        this.inner.check(object!, context)
    }
}

export const optional = <T>(type: Type<any, T>, name?: string) =>
    new OptionalType(type, name)