import { Environment, injectable, PostProcessor } from "../di";


import { AdviceAspect, Aspect } from "./aspect";
import { AspectInfo, AspectManager } from "./aspect-manager";

@injectable({module: "boot", scope: "environment"})
export class AdviceProcessor extends PostProcessor {
    // instance data

    info : Map<any, AspectInfo> = new Map()
    aspects : Map<Aspect, Aspect> = new Map()
    environment: Environment | undefined = undefined;

    constructor(environment: Environment) {
        super()
        this.environment = environment;
    }

    // public

    getAspectInfo(constructorFunction: any, compute: () => AspectInfo): AspectInfo {
        let info = this.info.get(constructorFunction)
        if (!info)
            this.info.set(constructorFunction, info = compute())

        return info
    }

    getAspect(aspect: Aspect) : Aspect {
        let result = this.aspects.get(aspect);
        if ( !result ) {
            if ( aspect instanceof AdviceAspect ) {
                const adviceAspect = aspect as AdviceAspect;
                result = adviceAspect.withInstance(this.environment!.get(adviceAspect.adviceInstance));
            }
            else {
                result = aspect
            }

            this.aspects.set(aspect, result)
        }

        return result;
    }

    // override

    override process(instance: any, environment: Environment): void {
        this.environment = environment;
        if ( instance.constructor !== AdviceProcessor)
            AspectManager.wrapMethods(this, instance.constructor, instance)
    }
}