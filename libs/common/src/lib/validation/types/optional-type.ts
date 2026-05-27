import { Type, ValidationContext} from "../type"

export class OptionalType<T> extends Type<OptionalType<T>, T | undefined> {
    constructor(public inner: Type<OptionalType<T>, T>, name?: string) {
        super(name ?? "optional " + inner.name)
    }

    override check(object: T | undefined, context: ValidationContext) {
        if (object === undefined) return
        this.inner.check(object!, context)
    }
}

export const optional = <T>(type: Type<any, T>, name?: string) =>
    new OptionalType(type, name)