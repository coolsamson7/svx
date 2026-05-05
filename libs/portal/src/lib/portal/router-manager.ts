import { Environment, injectable, onRunning } from '../di';
import { createRouter } from 'sv-router';
import { FeatureRegistry } from './feature-registry';


@injectable({eager: false})
export class RouterManager {
  // instance data

  router:   ReturnType<typeof createRouter> | null = null;
  registry: FeatureRegistry;

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

  // lifecylce

  @onRunning()
  buildRouter() {
    const config: Record<string, any> = {};

    // find features with routes

    const features = this.registry.findFeatures((f) => f.router != undefined);

    for (const feature of features) {
      const path = feature.router?.path!;

      const key = (path.startsWith('/') ? path : `/${path}`).replace(/\/{2,}/g, '/');

      config[key] = feature.loader!;
    }

    // Catch-all fallback route (sv-router wildcard keys start with `*`)
    //TODO config['*'] = () => import('./PageNotFound.svelte');

    this.router = createRouter(config);
  }

  // private

  #get(): ReturnType<typeof createRouter> {
    if (!this.router)
       this.buildRouter()

    return this.router!;
  }
}
