import { injectable } from '@svx/di';
import { TraceLevel, Tracer } from '@svx/common';
import type { Component } from 'svelte';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ComponentLoader = () => Promise<{ default: Component }>;

export interface RouterConfig {
  path: string;
}

export interface FeatureMeta {
  id: string;
  label: string;
  permissions?: string[];
  router?: RouterConfig;
  tags?: string[];
  remote?: string;
  version?: string;
  _source?: {
    file: string;
    line: number;
  };
}

// this is the data used internally

interface FeatureData extends FeatureMeta {
  loader?: ComponentLoader
  component?: Component
}

export interface Manifest {
  generated: string;
  project: string;
  remote?: string;
  features: FeatureMeta[];
}

export function defineFeature(meta: FeatureMeta, loader: ComponentLoader): void {
  if (FeatureRegistry.instance)
    FeatureRegistry.instance.defineFeature(meta, loader);

  else
    FeatureRegistry.remember({ ...meta, loader });
}

type FederationContainer = {
  get(module: string): Promise<() => any>;
  init(shareScope: any): Promise<void>;
};

// ── Feature Registry ────────────────────────────────────────────────────────

@injectable()
export class FeatureRegistry {
  // static data

  static instance? : FeatureRegistry;
  static pending: FeatureData[] = [];

  static remember(data: FeatureData) {
    FeatureRegistry.pending.push(data);
  }

  // instance data

  features = new Map<string, FeatureData>();

  #remoteCache = new Map<string, FederationContainer>();

  // constructor

  constructor() {
    FeatureRegistry.instance = this;

    for (const feature of FeatureRegistry.pending) {
      this.defineFeature(feature);
    }

    FeatureRegistry.pending.length = 0;
  }

  // public

  async bootComponents(importers: Record<string, () => Promise<any>>): Promise<void> {
    const localFeatures = this.findFeatures((f) => f.remote == undefined);

    await Promise.all(
      localFeatures
        .map(m => m._source?.file!)
        .map((file) => {
          const key = file.startsWith('./') ? file : `./${file}`;
          const importer = importers[key];
          if (!importer)
            return Promise.resolve();

          return importer().then(() => undefined);
        })
    );
  }

  findFeatures(filter: (f: FeatureMeta) => boolean): FeatureData[] {
    return [...this.features.values()].filter(filter);
  }

  async loadRemote(remote: string) : Promise<FederationContainer> {
      let container = this.#remoteCache.get(remote);

      if (!container) {
        console.log( remote);
        container = await import(/* @vite-ignore */  remote!);

        await container!.init(
          (globalThis as any).__federation_shared__ ?? {}
        );

        this.#remoteCache.set( remote, container!);
      }

      return container!
  }

  async loadManifests(...urls: string[]): Promise<this> {
    for (const url of urls)
      try {
        await this.loadManifest(url);
      }
      catch(e) {
        Tracer.Trace("router", TraceLevel.LOW, "failed to load manifest {0}", url)
      }

    return this;
  }

  async loadManifest(url: string): Promise<this> {
    const res = await fetch(url);
    if (!res.ok) {
      throw res.statusText;
    }

    const manifest: Manifest = await res.json();
    const remote = manifest.remote;

    const idToExpose = (id: string): string => {
      return `./${id.charAt(0).toUpperCase()}${id.slice(1)}`;
    }

    for (const meta of manifest.features) {
      if ( remote ) {
        // copy remote

        meta.remote = remote

        const data : FeatureData = {
          ...meta,
          loader: async () : Promise<{ default: Component }> => {
            // load remote

            let container = await this.loadRemote(meta.remote!);

            const exposed = idToExpose(meta.id);

            console.log(exposed)

            console.log(container)

            // get exposed component

            const factory = await container.get(exposed);

            console.log(factory)

            data.component = factory().default;

            console.log(data.component )

            return { default: data.component! };
          }
        }

        this.defineFeature(data);
      }
      else this.defineFeature(meta); // the defineFeature call will overwrite it!
    }

    console.log(
      `[FeatureRegistry] loaded ${manifest.features.length} features from ${manifest.project}`
    );

    return this;
  }

  defineFeature(feature: FeatureMeta, loader?: ComponentLoader): this {
    if (Tracer.ENABLED) {
      Tracer.Trace('portal', TraceLevel.HIGH, 'define feature {0}', feature.id);
    }

    if ( loader )
      this.features.set(feature.id, {
        ...feature,
        loader: loader
      });
    else this.features.set(feature.id, feature)

    return this;
  }

  getFeature(id: string): FeatureData | undefined {
    return this.features.get(id);
  }

  getFeatures(): FeatureMeta[] {
    return [...this.features.values()];
  }

  hasPermission(id: string, userPermissions: string[]): boolean {
    const meta = this.features.get(id);
    if (!meta) return false;
    if (!meta.permissions?.length) return true;
    return meta.permissions.some(p => userPermissions.includes(p));
  }

  async resolveComponent(id: string): Promise<Component> {
    const feature = this.getFeature(id)!

    // check cache

    if (feature.component) {
      return feature.component;
    }

    // execute loader

    if (feature.loader) {
      const mod = await feature.loader();
      const component = mod.default;

      feature.component = component

      return component;
    }

    else throw Error("missing loader")
  }
}
