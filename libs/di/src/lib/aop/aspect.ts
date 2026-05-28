import { AspectTarget } from "./aspect-target"
import { MethodDescriptor, TypeDescriptor } from "@svx/common"
import { Invocation } from "./invocation"
import { AspectType } from "./aspect-type.enum"
import { AspectConfig } from "./aspect-config"
import { AspectManager } from "./aspect-manager"

export type AspectFunc = Function

export abstract class Aspect {
    // instance data

    type: AspectType
    private targets: AspectTarget | undefined
    order: number
    private readonly enabledIf: string | undefined

    // constructor

    protected constructor(public func: AspectFunc, public config: AspectConfig) {
        this.type = config.type
        this.targets = config.target
        this.order = config.order || 0
        this.enabledIf = config.enabledIf
    }

    // public

    matches(typeDescriptor: TypeDescriptor<any>, method: MethodDescriptor, accept: (s: string) => boolean): boolean {
        if (this.enabledIf !== undefined && !accept(this.enabledIf!)) return false

        if ('adviceInstance' in this) {
            if ((this as any).adviceInstance === typeDescriptor.type)
                return false;
        }

        return this.targets?.matchesMethod(typeDescriptor, method) || false
    }

    // abstract

    abstract invoke(invocation: Invocation): any
}

export abstract class AdviceAspect extends Aspect {
    // instance data

    adviceInstance: any

    // constructor

    protected constructor(constructorFunction: any, func: AspectFunc, config: AspectConfig) {
        super(func, config)

        this.adviceInstance = constructorFunction
    }

    // protected

    withInstance(instance: any) {
       // shallow clone: preserve all properties from the subclass

       const clone = Object.create(Object.getPrototypeOf(this)) as this;
       Object.assign(clone, this);

       // replace

       clone.adviceInstance = instance;

       // done

       return clone;
    }

    // override Aspect

    invoke(invocation: Invocation): any {
        return this.func.apply(this.adviceInstance, [invocation])
    }
}

export class AroundAspect extends AdviceAspect {
    // constructor

    constructor(constructorFunction: any, func: AspectFunc, config: AspectConfig) {
        super(constructorFunction, func, config)
    }
}

export function around(config: AspectTarget | AspectConfig): any {
    return (target: any, property: string, descriptor: PropertyDescriptor) => {
        if (config instanceof AspectTarget) {
            AspectManager.registerAspect(
                new AroundAspect(target.constructor, descriptor.value, {
                    type: AspectType.AROUND,
                    target: config,
                    order: config.getOrder(),
                })
            )
        } else {
            AspectManager.registerAspect(new AroundAspect(target.constructor, descriptor.value, config))
        }
    }
}



export class BeforeAfterAspect extends AdviceAspect {
    // constructor

    constructor(constructorFunction: any, func: AspectFunc, config: AspectConfig) {
        super(constructorFunction, func, config)
    }
}

/**
 * any method decorated with this decorator will act as an before aspect for the specified target methods.
 * "Before" methods will be executed before all other - around and after - aspects including the original
 * method for both successful executions as well as error cases.
 * A before aspect needs to declare single {@link Invocation} argument
 * @param config the specification of the methods which should integrate this method as an aspect
 */
export function before(config: AspectTarget | AspectConfig): any {
    return (target: any, property: string, descriptor: PropertyDescriptor) => {
        if (config instanceof AspectTarget) {
            AspectManager.registerAspect(
                new BeforeAfterAspect(target.constructor, descriptor.value, {
                    type: AspectType.BEFORE,
                    target: config,
                    order: config.getOrder(),
                })
            )
        } else {
            AspectManager.registerAspect(new BeforeAfterAspect(target.constructor, descriptor.value, config))
        }
    }
}

export function after(config: AspectTarget | AspectConfig): any {
    return (target: any, property: string, descriptor: PropertyDescriptor) => {
        if (config instanceof AspectTarget) {
            AspectManager.registerAspect(
                new BeforeAfterAspect(target.constructor, descriptor.value, {
                    type: AspectType.AFTER,
                    target: config,
                    order: config.getOrder(),
                })
            )
        } else {
            AspectManager.registerAspect(new BeforeAfterAspect(target.constructor, descriptor.value, config))
        }
    }
}


export class ErrorAspect extends AdviceAspect {
    // constructor

    constructor(constructorFunction: any, func: AspectFunc, config: AspectConfig) {
        super(constructorFunction, func, config)
    }
}

export function error(config: AspectTarget | AspectConfig): any {
    return (target: any, property: string, descriptor: PropertyDescriptor) => {
        if (config instanceof AspectTarget) {
            AspectManager.registerAspect(
                new ErrorAspect(target.constructor, descriptor.value, {
                    type: AspectType.ERROR,
                    target: config,
                    order: config.getOrder(),
                })
            )
        } else {
            AspectManager.registerAspect(new ErrorAspect(target.constructor, descriptor.value, config))
        }
    }
}


export class MethodAspect extends Aspect {
    // constructor

    constructor(func: AspectFunc) {
        super(func, { type: AspectType.METHOD })
    }

    // override

    invoke(invocation: Invocation): any {
        return (invocation.result = this.func.apply(invocation.target, invocation.args))
    }
}


export function aspect(config: AspectConfig): any {
    return (target: any, property: string, descriptor: PropertyDescriptor) => {
        if (config.type === AspectType.AROUND)
            AspectManager.registerAspect(new AroundAspect(target.constructor, descriptor.value, config))
        else AspectManager.registerAspect(new BeforeAfterAspect(target.constructor, descriptor.value, config))
    }
}

import "./advice-processor"
