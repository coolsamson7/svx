import { Invocation } from "./invocation"
import { Aspect } from "./aspect"

export class JoinPoint {
    constructor(public aspect: Aspect, public next: JoinPoint | undefined = undefined) {}

    run<T = any>(invocation: Invocation): any {
        return this.aspect.invoke(invocation)
    }
}
