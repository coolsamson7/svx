import { JoinPoint } from "./join-point"
import { MethodDescriptor, TypeDescriptor } from '@svx/common';
import { Invocation } from "./invocation"
import { TraceLevel, Tracer } from '@svx/common';
import { AdviceAspect, Aspect, MethodAspect } from "./aspect"
import { AspectType } from "./aspect-type.enum"
import { AdviceProcessor } from "./advice-processor"

export interface JoinPoints {
    before: JoinPoint[]
    around: JoinPoint
    error: JoinPoint[]
    method: MethodAspect
    after: JoinPoint[]
}

export interface AspectInfo {
    nAspects: number
    typeDescriptor: TypeDescriptor<any>
    propertyDescriptors: { [name: string]: PropertyDescriptor }
    wrappedMethods: { [name: string]: JoinPoints }
}



export class AspectManager {
    // static data

    static accept: (key: string) => boolean = (key: string) => true

    // static methods

    public static acceptConfig(predicate: (key: string) => boolean) {
        AspectManager.accept = predicate
    }

    // instance data

    private static aspects: Aspect[] = []

    // public

    static registerAspect(aspect: AdviceAspect): void {
        if (Tracer.ENABLED)
            Tracer.Trace(
                "aop",
                TraceLevel.HIGH,
                "register {0} aspect {1}.{2}",
                AspectType[aspect.type].toLowerCase(),
                aspect.adviceInstance.name,
                aspect.func.name
            )

        this.aspects.push(aspect)
    }

    static wrapMethods(processor: AdviceProcessor, constructorFunction: any, thisPointer: any): void {
        const aspectInfo = processor.getAspectInfo(constructorFunction, () => AspectManager.getAspectInfo(processor, constructorFunction))
        const descriptors = aspectInfo.propertyDescriptors
        const typeDescriptor = aspectInfo.typeDescriptor

        for (const method in aspectInfo.wrappedMethods) {
            if (Tracer.ENABLED)
                Tracer.Trace("aop", TraceLevel.FULL, "weave aspects in method {0}.{1}", typeDescriptor.type.name, method)

            const descriptor = descriptors[method]
            const joinPoints = aspectInfo.wrappedMethods[method]

            if (typeDescriptor.getMethod(method)?.async)
                descriptor.value = (...args: any[]) => new Invocation<any>(thisPointer, joinPoints).runAsync(...args)
            else
                descriptor.value = (...args: any[]) => new Invocation<any>(thisPointer, joinPoints).run(...args)

            Reflect.set(thisPointer, method, descriptor.value)
        }
    }

    // private

    private static getAspectInfo(processor: AdviceProcessor, constructorFunction: any): AspectInfo {
        if (Tracer.ENABLED) Tracer.Trace("aop", TraceLevel.HIGH, "compute aspects for {0}", constructorFunction.name)

        return {
            typeDescriptor: TypeDescriptor.forType(constructorFunction),
            nAspects: this.aspects.length,
            propertyDescriptors: Object.getOwnPropertyDescriptors(constructorFunction.prototype),
            wrappedMethods: this.computeMethodWrappers(processor, constructorFunction),
        }
    }

    private static computeMethodWrappers(processor: AdviceProcessor, constructorFunction: any): { [name: string]: JoinPoints } {
        const typeDescriptor = TypeDescriptor.forType(constructorFunction)

        // compute methods to wrap

        const wrappedMethods: { [name: string]: JoinPoints } = {}

        for (const method of typeDescriptor.getMethods()) {
            const joinPoint = this.applicableAspects(processor, typeDescriptor, method)

            if (joinPoint) {
                if (Tracer.ENABLED)
                    Tracer.Trace(
                        "aop",
                        TraceLevel.FULL,
                        "remember aspects for method {0}.{1}",
                        typeDescriptor.type.name,
                        method.name
                    )

                wrappedMethods[method.name] = joinPoint
            }
        } // for

        return wrappedMethods
    }

    private static matchingAspects(processor: AdviceProcessor, typeDescriptor: TypeDescriptor<any>, originalMethod: MethodDescriptor, type: AspectType): Aspect[] {
        const environment = processor.environment!
        return this.aspects
            // only advices that are known to the environment!
            .filter((aspect) => environment.supports((aspect as AdviceAspect).adviceInstance))
            .filter((aspect) =>
                aspect.type == type && aspect.matches(typeDescriptor, originalMethod, AspectManager.accept))
            .sort((a, b) => {
                if (b.order > a.order) return 1
                else if (b.order < a.order) return -1
                else return 0
            })
            .map((aspect) => processor.getAspect(aspect))
    }

    private static link(...aspects: Aspect[]): JoinPoint {
        let joinPoint: JoinPoint | undefined = undefined
        for (let i = aspects.length - 1; i >= 0; i--) joinPoint = new JoinPoint(aspects[i], joinPoint)

        return joinPoint!
    }

    private static applicableAspects(processor: AdviceProcessor, typeDescriptor: TypeDescriptor<any>, originalMethod: MethodDescriptor): JoinPoints | undefined {
        const before = this.matchingAspects(processor, typeDescriptor, originalMethod, AspectType.BEFORE)
        const around = this.matchingAspects(processor, typeDescriptor, originalMethod, AspectType.AROUND)
        const error = this.matchingAspects(processor, typeDescriptor, originalMethod, AspectType.ERROR)
        const after = this.matchingAspects(processor, typeDescriptor, originalMethod, AspectType.AFTER)

        if (before.length + after.length + around.length + error.length > 0) {
            const methodAspect = new MethodAspect(originalMethod.method)
            return {
                before: before.map((aspect) => new JoinPoint(aspect)),
                after: after.map((aspect) => new JoinPoint(aspect)),
                error: error.map((aspect) => new JoinPoint(aspect)),
                around: this.link(...around, methodAspect),
                method: methodAspect,
            }
        } else return undefined
    }
}
