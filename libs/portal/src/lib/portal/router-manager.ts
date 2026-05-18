import { Environment, injectable } from '@svx/di';
import { createRouter, type HooksContext }    from 'sv-router';
import { FeatureRegistry, FeatureDescriptor }       from './feature-registry';

export type RouteGuard = (feature: FeatureDescriptor, ctx: HooksContext) => void | Promise<void>

@injectable({eager: false})
export class RouterManager {
  // instance data

  router:   ReturnType<typeof createRouter> | null = null;
  registry: FeatureRegistry;

  #guard?:         RouteGuard
  #pathToFeature = new Map<string, FeatureDescriptor>()

  // constructor

  constructor(private environment: Environment) {
    this.registry = environment.get(FeatureRegistry);
  }

  // public

  get navigate() {
    return this.#get().navigate;
  }

  get isActive() {
    return this.#get().isActive;
  }

  get route() {
    return this.#get().route;
  }

  get p() {
    return this.#get().p;
  }

  setGuard(fn: RouteGuard): void {
    this.#guard = fn;
  }

  buildRouter() {
    const config: Record<string, any> = {};

    const features = [...this.registry.features.values()].filter((f) => f.router != undefined);

    for (const feature of features) {
      const path = feature.router?.path!;
      const key  = (path.startsWith('/') ? path : `/${path}`).replace(/\/+/g, '/');

      if (feature.loader) config[key] = feature.loader;
      this.#pathToFeature.set(key, feature);
    }

    this.router = createRouter({
      ...config,
      hooks: {
        beforeLoad: async (ctx: HooksContext) => {
          if (!this.#guard) return;
          const feature = this.#pathToFeature.get(ctx.pathname);
          if (!feature) return;
          await this.#guard(feature, ctx);
        },
      },
    });
  }

  // private

  #get(): ReturnType<typeof createRouter> {
    if (!this.router)
       this.buildRouter()

    return this.router!;
  }
}
