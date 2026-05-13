import { FeatureMeta, FeatureRegistry, Manifest } from './feature-registry';
import { ClientInfo, detectClient } from '../util/client-detector';
import { FilterContext, ManifestProcessor } from './manifest-filter';
import { TraceLevel, Tracer } from '@svx/common';

export interface Deployment {
  modules: { [key: string]: Manifest };
}

/**
 * a {@link DeploymentRequest} covers the necessary information to compute a {@link Deployment}
 */
export interface DeploymentRequest {
  /**
   * the application name
   */
  application: string;
  /**
   * the {@link ClientInfo} of the requesting browser
   */
  client: ClientInfo;
}

export abstract class DeploymentLoader {
  /**
   * load a {@link Deployment}
   * @param request a {@link DeploymentRequest}
   * @returns the {@link Deployment}
   */
  abstract load(request: DeploymentRequest): Promise<Deployment>;
}

/**
 * options for the {@link DeploymentManager}
 */
export interface DeploymentManagerOptions {
  /**
   * the  {@link FeatureRegistry}
   */
  featureRegistry: FeatureRegistry;
  /**
   * the {@link DeploymentLoader}
   */
  loader: DeploymentLoader;
  /**
   * the lcoal {@link Manifest}
   */
  localManifest: Manifest;
  /**
   * an optional {@link ManifestProcessor} used to filter features
   */
  processor?: ManifestProcessor;
}

/**
 * A `DeploymentManager` is responsible to compute a {@link Deployment} for a an applciation
 */
export class DeploymentManager {
  // instance data

  deployment?: Deployment;

  private featureRegistry: FeatureRegistry;
  private loader: DeploymentLoader;
  private localManifest: Manifest;
  private processor?: ManifestProcessor;

  // constructor

  /**
   * create a new {@link DeploymentManager}
   * @param options possible options
   */
  constructor(options: DeploymentManagerOptions) {
    this.featureRegistry = options.featureRegistry;
    this.loader = options.loader;
    this.localManifest = options.localManifest;
    this.processor = options.processor;
  }

  // public

  loaded(module: string) {
    if (this.deployment && this.deployment.modules[module])
      this.getModule(module).loaded = true;
  }

  /**
   *
   * @returns return the computed {@link DeploymentRequest}
   */
  getDeployment(): Deployment {
    if (this.deployment) return this.deployment;

    throw new Error('deployment not loaded yet');
  }

  getModule(module: string): Manifest {
    const manifest = this.getDeployment().modules[module];
    if (manifest) return manifest;

    throw new Error(`module ${module} not found`);
  }

  /**
   *
   * @returns return the {@link ClientInfo} of this application
   */
  clientInfo(): ClientInfo {
    return detectClient();
  }

  /**
   *
   * @param request load a deployment given a {@link DeploymentRequest}
   * @returns the {@link Deployment}
   */
  async loadDeployment(request: DeploymentRequest): Promise<Deployment> {
    if (Tracer.ENABLED)
      Tracer.Trace(
        'portal',
        TraceLevel.HIGH,
        'load deployment for application {0}',
        request.application,
      );

    this.deployment = await this.loader.load(request);

    // add local features

    this.deployment.modules[this.localManifest.id!] = this.localManifest;

    // apply manifest processor if available

    if (this.processor) {
      const filterContext: FilterContext = {
        clientInfo: this.clientInfo(),
      };

      for (const moduleName in this.deployment.modules) {
        const module = this.deployment.modules[moduleName];
        this.deployment.modules[moduleName] = this.processor.process(
          module,
          filterContext,
        );
      }
    }

    this.deployment.modules[this.localManifest.id!].loaded = true;

    // copy module / uri

    for (const moduleName in this.deployment.modules) {
      const module = this.deployment.modules[moduleName];

      for (const feature of module.features as FeatureMeta[]) {
        // copy module / uri

        feature.remote = module.remote;
        // Use the module key from the deployment (moduleName), not the module.module property
        // The moduleName is the webpack module federation container name
        //TODO feature.module = moduleName;

        // check label

        if (!feature.label) feature.label = feature.id;
      }
    }

    // merge all features from deployment

    const features = Object.values(this.deployment.modules).flatMap(
      (m) => m.features,
    );

    // register features in the registry

    //TODO FOO this.featureRegistry.register(...features);

    // done

    console.log('### deployment ', this.deployment);

    return this.deployment;
  }
}


export interface RemoteManifestUrl {
  name: string;
  url: string;
}

export class RemoteDeploymentLoader implements DeploymentLoader {
  // instance data

  private remoteUrls: RemoteManifestUrl[];

  // constructor

  constructor(remoteUrls: RemoteManifestUrl[]) {
    this.remoteUrls = remoteUrls;
  }

  // implement DeploymentLoader

  async load(request: DeploymentRequest): Promise<Deployment> {
    const modules: Record<string, Manifest> = {};

    // Fetch all manifests in parallel
    const manifestPromises = this.remoteUrls.map(async (remote) => {
      try {
        const response = await fetch(`${remote.url}/manifest.json`);
        if (!response.ok) {
          console.error(
            `Failed to fetch manifest from ${remote.url}: ${response.statusText}`,
          );
          return null;
        }

        const manifest: Manifest = await response.json();

        // Set the module name and URI
        manifest.id = remote.name;
        manifest.remote = remote.url;
        //manifest.module = remote.name;

        return { name: remote.name, manifest };
      } catch (error) {
        console.error(`Error fetching manifest from ${remote.url}:`, error);
        return null;
      }
    });

    // Wait for all fetches to complete
    const results = await Promise.all(manifestPromises);

    // Add successfully fetched manifests to modules
    for (const result of results) {
      if (result) {
        modules[result.name] = result.manifest;
      }
    }

    return {
      modules,
    };
  }
}


export class EmptyDeploymentLoader implements DeploymentLoader {
  // implement DeploymentLoader

  load(request: DeploymentRequest): Promise<Deployment> {
    return Promise.resolve({
      modules: {},
    });
  }
}
