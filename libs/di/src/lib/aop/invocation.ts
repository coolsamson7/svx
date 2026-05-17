import { JoinPoints } from "./aspect-manager"
import { JoinPoint } from "./join-point"

/**
 * An <code>Invocation</code> covers all runtime aspects of a method invocation as passed to individual advices.
 * Especially it covers the main properties
 * <ul>
 *     <li>the supplied arguments to the original method ( which could be modified by an aspect )</li>
 *     <li>the result value of the original method</li>
 *     <li>the error in case of caught exceptions</li>
 * </ul>
 */
export class Invocation<TARGET = any> {
    // instance data

    args: any[] | undefined
    result: any = undefined
    error: any = undefined

    currentJoinPoint: JoinPoint | undefined

    // constructor

    constructor(public target: TARGET, private joinPoints: JoinPoints) {}

    // public

    arguments(): any[] {
        return <any[]>this.args
    }

    method() {
        return this.joinPoints.method.func
    }

    proceed<T>(): T {
        return (this.currentJoinPoint = this.currentJoinPoint?.next)?.run<T>(this)
    }

    run(...args: any[]): any {
        this.args = args
        this.result = undefined
        this.error = undefined

        // get goin'

        const joinPoints = this.joinPoints

        // run all before

        for (const joinPoint of joinPoints.before) (this.currentJoinPoint = joinPoint).run(this)

        // run arounds with the method being the last aspect!

        //let caught = false
        try {
            ;(this.currentJoinPoint = joinPoints.around)?.run(this)
        } catch (error) {
            if (joinPoints.error.length > 0) {
                this.error = error
                //caught = joinPoints.error.length > 0 // ??? and now?
                for (const joinPoint of joinPoints.error) (this.currentJoinPoint = joinPoint).run(this)
            }
        }

        // run all after

        for (const joinPoint of joinPoints.after) (this.currentJoinPoint = joinPoint).run(this)

        if (this.error) throw this.error
        else return this.result
    }

    async runAsync(...args: any[]): Promise<any> {
        this.args = args

        // run all before

        for (const joinPoint of this.joinPoints.before) (this.currentJoinPoint = joinPoint).run(this)

        // run arounds with the method being the last aspect!

        return (this.currentJoinPoint = this.joinPoints.around)
            .run<Promise<any>>(this)
            .then((result: any) => {
                this.result = result

                // run all after

                for (const joinPoint of this.joinPoints.after) (this.currentJoinPoint = joinPoint).run(this)

                // done

                return this.result
            })
            .catch((error: any) => {
                this.error = error

                // call error handlers

                let rethrow = undefined
                try {
                    for (const joinPoint of this.joinPoints.error) (this.currentJoinPoint = joinPoint).run(this)
                } catch (error) {
                    rethrow = error
                }

                // call after?

                for (const joinPoint of this.joinPoints.after) (this.currentJoinPoint = joinPoint).run(this)

                if (rethrow) throw rethrow
            })
    }
}
