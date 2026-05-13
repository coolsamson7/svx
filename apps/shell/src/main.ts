import 'reflect-metadata'

import {
  ConfigurationManager,
  ConsoleTrace,
  TraceLevel,
  Tracer,
  TypeDescriptor,
  ValueConfigurationSource,
} from '@svx/common';

import {
  Authentication,
  OIDCUser,
  Session,
  SessionManager,
} from '@svx/security';

import user from './user.json';

AxiosRestChannel.loadReflection(user as ProxySchema);

import {
  Environment,
  module,
  onRunning,
  Module,
  injectable,
  create,
} from '@svx/di';

import { Component, ComponentDescriptor} from "@svx/service-common"
import {
  AxiosRestChannel,
  ComponentLocator,
  ProxySchema,
  ServiceInstanceProvider,
} from '@svx/service-client';

import { UserInventoryService } from '@svx/user-interface';

import {
  DeploymentLoader,
  DeploymentManager,
  FeatureRegistry,
  ManifestProcessor,
  RemoteDeploymentLoader,
} from '@svx/portal';

import { mount } from 'svelte';

new Tracer({
      enabled: true,
      trace: new ConsoleTrace('%d [%p]: %m\n'), // %f
      paths: {
        di: TraceLevel.FULL,
        router: TraceLevel.FULL,
        portal: TraceLevel.FULL,
        application: TraceLevel.FULL
      }
});

export interface LoginRequest {
  user?: string;
  password?: string;
}

/**
 * No-op authentication service that returns a dummy user.
 */
export class DummyAuthentication
  implements Authentication<LoginRequest, OIDCUser, any>
{
  async login(request: LoginRequest): Promise<Session<OIDCUser, any>> {
    return {
      user: {
        id: request.user,
        username: request.user,
        email: request.user + '@example.com',
        roles: ['user'],
        given_name: '',
        family_name: '',
        email_verified: '',
        name: '',
        preferred_username: '',
        sub: '',
      },
      ticket: {},
      sessionLocals: {},
    };
  }

  async start(): Promise<Session<OIDCUser, any> | null> {
    return null;
  }

  async logout(): Promise<void> {
    // noop
  }
}

// main module

export const applicationConfig = {
  deployment: 'local', // microfrontend local service
  deployments: {
    local: {},
    service: {},
    microfrontend: {
      remotes: [{ name: 'microfrontend', url: 'http://localhost:3001' }],
    },
  },
  server: {
    url: 'http://localhost:8000/',
  },
};

@module()
class ApplicationModule extends Module {
  @create()
  createConfigurationManager(): ConfigurationManager {
    return new ConfigurationManager(new ValueConfigurationSource({}));
  }

  @create()
  createSessionManager(): SessionManager<any, any> {
    return new SessionManager(new DummyAuthentication());
    /*return new SessionManager(new OIDCAuthentication({
       url: "http://localhost:8080",
       realm: "service",
       clientId: "service-browser"
    }));*/
  }

  @create()
  createDeploymentLoader(): DeploymentLoader {
    return new RemoteDeploymentLoader([])
  }

  @create()
  createDeploymentManager(loader: DeploymentLoader, featureRegistry: FeatureRegistry) : DeploymentManager {
    return new DeploymentManager({
      featureRegistry: featureRegistry,
      loader: loader,
      localManifest: {
        generated: '',
        loaded: false,
        id: '',
        label: '',
        version: '',
        features: []
      }, // TODO,manifest as Manifest,
      processor: new ManifestProcessor({
        hasFeature: (feature) => true,
        hasPermission: (permission) => true
      })
    });
    }

  // lifecycle

  @onRunning()
  async setup(sessionManager: SessionManager): Promise<void> {
    console.log('ApplicationModule.setup');

    await sessionManager.start();
  }
}

@injectable()
export class StaticComponentLocator extends ComponentLocator {
  // implement

  locate(_component: ComponentDescriptor<Component>): string {
    return 'http://localhost:3000/api';
  }
}

// register providers for the service proxies

ServiceInstanceProvider.registerServiceProviders();

// start environment

const environment = new Environment({ module: ApplicationModule });
await environment.start();

console.log(environment.report());

const service = environment.get<UserInventoryService>(
  UserInventoryService as any,
); //
const rr = await service.findAll();

// load local and remote manifests

const registry = environment.get(FeatureRegistry);
const deploymentManager = environment.get(DeploymentManager);

await registry.loadManifests(
  '/manifest.json',
  //'http://localhost:4201/manifest.json'
);

/* TODO await deploymentManager.loadDeployment({
  application: 'portal',
  client: deploymentManager.clientInfo(),
});*/

// force loading of local components

await registry.bootComponents(import.meta.glob('./features/**/*.svelte')); // maybe subfolder is better

// report

console.log(environment.report());

// mount app

import './main.css';

const { default: App } = await import('./App.svelte');

mount(App, {
  target: document.getElementById('app')!,
  props: {
    environment
  }
});
