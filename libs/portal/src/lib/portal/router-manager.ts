import { Environment, injectable } from '@svx/di';
import { createRouter, type HooksContext }    from 'sv-router';
import { FeatureRegistry, FeatureDescriptor }       from './feature-registry';
import { SessionManager } from '@svx/security';

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

  async runGuardForCurrentPath(): Promise<void> {
    if (!this.#guard) return;
    this.#get();
    const feature = this.#pathToFeature.get(window.location.pathname);
    if (!feature) return;
    try {
      await this.#guard(feature, { pathname: window.location.pathname } as any);
    } catch (e) {
      console.debug('[guard] suppressed', e);
    }
  }

  navigateAfterLogin(): void {
    const saved = sessionStorage.getItem('redirect_after_login');
    if (!saved) return;
    sessionStorage.removeItem('redirect_after_login');
    if (this.router) {
      this.navigate(saved as `/${string}`);
    } else {
      history.replaceState({}, '', saved);
    }
  }

  useSecurityGuard(sessionManager: SessionManager<any, any, any>, useLoginForm = false): void {
    this.setGuard(async (feature) => {
      const isPublic = (feature.visibility ?? []).includes('public');
      if (isPublic) return;

      if (!sessionManager.hasSession()) {
        sessionStorage.setItem('redirect_after_login', window.location.pathname);
        const loginFeature = useLoginForm
          ? this.registry.finder().withTag('login').findOptional()
          : undefined;
        if (loginFeature?.router) {
          this.navigate(('/' + loginFeature.router.path) as `/${string}`);
        } else {
          await sessionManager.openSession(undefined);
        }
        return;
      }

      const roles = new Set(sessionManager.currentSession().user.roles as string[]);
      const allowed = (feature.permissions ?? []).every(p => roles.has(p));
      if (!allowed) {
        const target = this.registry.finder().withTag('unauthorized').findOptional();
        if (target?.router) this.navigate(('/' + target.router.path) as `/${string}`);
      }
    });
  }

  buildRouter() {
    const config: Record<string, any> = {};
    const all    = [...this.registry.features.values()];

    // only features that have a loader are runtime-renderable
    const childrenOf = new Map<string, typeof all>();
    for (const f of all) {
      if (f.parent && f.loader) {
        const list = childrenOf.get(f.parent) ?? [];
        list.push(f);
        childrenOf.set(f.parent, list);
      }
    }

    for (const feature of all) {
      if (!feature.router || feature.parent || !feature.loader) continue;

      const key      = ('/' + feature.router.path).replace(/\/+/g, '/');
      const children = childrenOf.get(feature.id) ?? [];

      if (children.length > 0) {
        const nested: Record<string, any> = { layout: feature.loader };
        for (const child of children) {
          const childKey = ('/' + child.router!.path).replace(/\/+/g, '/');
          nested[childKey] = child.loader;
          this.#pathToFeature.set((key + '/' + child.router!.path).replace(/\/+/g, '/'), child);
        }
        config[key] = nested;
      } else {
        config[key] = feature.loader;
      }

      this.#pathToFeature.set(key, feature);
    }

    const notFound = all.find(f => (f.tags ?? []).includes('not-found') && f.loader);
    if (notFound) (config as any)['*'] = notFound.loader;

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
