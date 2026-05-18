import { injectable } from '@svx/di';
import { TraceLevel, Tracer } from '@svx/common';
import type { Component } from 'svelte';
import { ClientInfo } from '../util/client-detector';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ComponentLoader = () => Promise<{ default: Component }>;

export interface RouterConfig {
  path: string;
}


export interface ClientConstraints {
  screenSizes?: Array<string> | null;
  orientation?: Array<string> | null;
  platforms?: Array<string> | null;
  minWidth?: number | null;
  maxWidth?: number | null;
  minHeight?: number | null;
  maxHeight?: number | null;
  capabilities?: Array<string> | null;
}

export interface FeatureDescriptor {
  id: string;
  label: string;
  enabled?: boolean;
  permissions?: string[];
  router?: RouterConfig;
  tags?: string[];
  remote?: string;
  version?: string;
  visibility?: Array<string>; // better
  clients?: ClientConstraints | null;
  children?: FeatureDescriptor[];
  _source?: {
    file: string;
    line: number;
  };
}

// this is the data used internally

interface FeatureData extends FeatureDescriptor {
  loader?: ComponentLoader
  component?: Component
}

export interface Manifest {
  generated: string;
  enabled?: boolean;
  loaded: boolean;
  id: string;
  label: string;
  version: string;
  remote?: string;
  features: FeatureDescriptor[];
}

export function defineFeature(meta: FeatureDescriptor, loader: ComponentLoader): void {
  if (FeatureRegistry.instance)
    FeatureRegistry.instance.defineFeature(meta, loader);

  else
    FeatureRegistry.remember({ ...meta, loader });
}

type FederationContainer = {
  get(module: string): Promise<() => any>;
  init(shareScope: any): Promise<void>;
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type PermissionChecker = (feature: FeatureDescriptor) => boolean

// ── Feature Registry ────────────────────────────────────────────────────────

@injectable()
export class FeatureRegistry {
  // static data

  static instance?: FeatureRegistry;
  static pending: FeatureData[] = [];

  static remember(data: FeatureData) {
    FeatureRegistry.pending.push(data);
  }

  // instance data

  features = new Map<string, FeatureData>();

  #remoteCache = new Map<string, FederationContainer>();
  #permissionChecker?: PermissionChecker;

  // constructor

  constructor() {
    FeatureRegistry.instance = this;

    for (const feature of FeatureRegistry.pending) {
      this.defineFeature(feature);
    }

    FeatureRegistry.pending.length = 0;
  }

  // public

  setPermissionChecker(checker: PermissionChecker): void {
    this.#permissionChecker = checker;
  }

  checkPermission(feature: FeatureDescriptor): boolean {
    if (!this.#permissionChecker) return true;
    return this.#permissionChecker(feature);
  }

  async bootComponents(
    importers: Record<string, () => Promise<any>>,
  ): Promise<void> {
    const localFeatures = [...this.features.values()].filter(
      (f) => f.remote == undefined,
    );

    await Promise.all(
      localFeatures
        .map((m) => m._source?.file!)
        .map((file) => {
          const key = file.startsWith('./') ? file : `./${file}`;
          const importer = importers[key];
          if (!importer) return Promise.resolve();

          return importer().then(() => undefined);
        }),
    );
  }

  findFeatures(filter: (f: FeatureDescriptor) => boolean): FeatureData[] {
    return [...this.features.values()].filter((f) => {
      if (!filter(f)) return false;
      if (!this.#permissionChecker) return true;
      return this.#permissionChecker(f);
    });
  }

  async loadRemote(remote: string): Promise<FederationContainer> {
    let container = this.#remoteCache.get(remote);

    if (!container) {
      console.log(remote);
      container = await import(/* @vite-ignore */ remote!);

      await container!.init((globalThis as any).__federation_shared__ ?? {});

      this.#remoteCache.set(remote, container!);
    }

    return container!;
  }

  registerManifest(manifest: Manifest): this {
    const remote = manifest.remote;

    const idToExpose = (id: string): string =>
      `./${id.charAt(0).toUpperCase()}${id.slice(1)}`;

    for (const meta of manifest.features) {
      if (remote) {
        meta.remote = remote;

        const data: FeatureData = {
          ...meta,
          loader: async (): Promise<{ default: Component }> => {
            const container = await this.loadRemote(meta.remote!);
            const factory = await container.get(idToExpose(meta.id));
            data.component = factory().default;
            return { default: data.component! };
          },
        };

        this.register(data);
      } else {
        this.register(meta);
      }
    }

    return this;
  }

  register(...features: FeatureDescriptor[]) {
    // local function

    const register = (
      feature: FeatureDescriptor,
      parent: FeatureDescriptor | null = null,
    ) => {
      // fix qualified name

      if (parent) feature.id = parent.id + '.' + feature.id;

      // register

      this.features.set(feature.id, feature);

      // i18n

      /*if (feature.i18n && !feature.label) {
        feature.label = this.translator.translate(
          'portal:' + feature.i18n + '.label',
        );
      }*/

      // recursion

      if (feature.children)
        for (const child of feature.children) register(child, feature);
    };

    features.forEach((f) => register(f));
  }

  defineFeature(feature: FeatureDescriptor, loader?: ComponentLoader): this {
    if (Tracer.ENABLED) {
      Tracer.Trace('portal', TraceLevel.HIGH, 'define feature {0}', feature.id);
    }

    if (loader)
      this.features.set(feature.id, {
        ...feature,
        loader: loader,
      });
    else this.features.set(feature.id, feature);

    return this;
  }

  getFeature(id: string): FeatureData | undefined {
    return this.features.get(id);
  }

  getFeatures(): FeatureDescriptor[] {
    return [...this.features.values()];
  }

  hasPermission(id: string, userPermissions: string[]): boolean {
    const meta = this.features.get(id);
    if (!meta) return false;
    if (!meta.permissions?.length) return true;
    return meta.permissions.some((p) => userPermissions.includes(p));
  }

  async resolveComponent(id: string): Promise<Component> {
    const feature = this.getFeature(id)!;

    // check cache

    if (feature.component) {
      return feature.component;
    }

    // execute loader

    if (feature.loader) {
      const mod = await feature.loader();
      const component = mod.default;

      feature.component = component;

      return component;
    } else throw Error('missing loader');
  }

  finder(): FeatureFinder {
    return new FeatureFinder(this);
  }

  filter(f: FeatureFinderFilter): FeatureDescriptor[] {
    return Array.from(this.features.values()).filter(f);
  }
}

/**
 * Check if client matches the given constraints
 */
export function clientMatchesConstraints(
  client: ClientInfo,
  constraints?: ClientConstraints
): boolean {
  if (!constraints) return true;

  // Check screen size
  if (constraints.screenSizes && constraints.screenSizes.length > 0) {
    if (
      !constraints.screenSizes.includes("*") &&
      !constraints.screenSizes.includes(client.screen_size)
    ) {
      return false;
    }
  }

  // Check orientation
  if (constraints.orientation && constraints.orientation.length > 0) {
    if (
      !constraints.orientation.includes("*") &&
      !constraints.orientation.includes(client.orientation)
    ) {
      return false;
    }
  }

  // Check platform
  if (constraints.platforms && constraints.platforms.length > 0) {
    if (
      !constraints.platforms.includes("*") &&
      !constraints.platforms.includes(client.platform)
    ) {
      return false;
    }
  }

  // Check precise width constraints
  if (constraints.minWidth !== undefined && client.width < constraints.minWidth!) {
    return false;
  }
  if (constraints.maxWidth !== undefined && client.width > constraints.maxWidth!) {
    return false;
  }

  // Check precise height constraints
  if (constraints.minHeight !== undefined && client.height < constraints.minHeight!) {
    return false;
  }
  if (constraints.maxHeight !== undefined && client.height > constraints.maxHeight!) {
    return false;
  }

  // Check capabilities
  if (constraints.capabilities && constraints.capabilities.length > 0) {
    const hasAllCapabilities = constraints.capabilities.every((cap) =>
      client.capabilities.includes(cap)
    );
    if (!hasAllCapabilities) {
      return false;
    }
  }

  return true;
}



export type FeatureFinderFilter = (feature: FeatureDescriptor) => boolean;

export class FeatureFinder {
  filter: FeatureFinderFilter[] = [];

  constructor(private registry: FeatureRegistry) {}

  // fluent

  withId(id: string): FeatureFinder {
    this.filter.push((feature) => feature.id == id);
    return this;
  }

  /*withoutParent(): FeatureFinder {
    this.filter.push((feature) => feature.parent == null);

    return this;
  }

  withPath(path: string | null = null): FeatureFinder {
    if (path) this.filter.push((feature) => feature.path == path);
    else this.filter.push((feature) => feature.path !== null);

    return this;
  }*/

  withTag(tag: string): FeatureFinder {
    this.filter.push((feature) => (feature.tags || []).includes(tag));
    return this;
  }

  matchesSession(session: boolean): FeatureFinder {
    if (session)
      // When user is logged in, show both 'public' and 'private' features
      this.filter.push((feature) => {
        const visibility = feature.visibility || ['public', 'private'];
        return visibility.includes('public') || visibility.includes('private');
      });
    else
      // When user is NOT logged in, show only 'public' features
      this.filter.push((feature) =>
        (feature.visibility || ['public']).includes('public'),
      );

    return this;
  }

  withVisibility(visibility: 'public' | 'private'): FeatureFinder {
    this.filter.push((feature) => {
      return (feature.visibility || ['public', 'private']).includes(visibility);
    });

    return this;
  }

  // find

  findOptional(): FeatureDescriptor | undefined {
    const result = this.find();

    if (result.length == 1) return result[0];
    else if (result.length == 0) return undefined;
    else
      throw new Error(
        'expected 0 or 1 feature with filter' +
          this.filter +
          ', got ' +
          result.length,
      );
  }

  findOne(): FeatureDescriptor {
    const result = this.find();

    if (result.length == 1) return result[0];
    else
      throw new Error(
        'expected 1 feature with filter' +
          this.filter +
          ', got ' +
          result.length,
      );
  }

  find(): FeatureDescriptor[] {
    return this.registry.filter((feature) => {
      for (const filter of this.filter)
        if (!filter(feature)) {
          return false;
        }

      return true;
    });
  }
}

