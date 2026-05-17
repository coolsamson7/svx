import 'reflect-metadata'

import {
  ConfigurationManager,
  ConsoleTrace,
  TraceLevel,
  Tracer,
  ValueConfigurationSource,
} from '@svx/common';

import {
  Authentication,
  OIDCUser,
  Session,
  SessionManager,
} from '@svx/security';

import { UserInventoryService } from "@svx/user-interface"

import manifest from './manifest.json';

import {
  Environment,
  module,
  onRunning,
  Module,
  injectable,
  create,
  config,
} from '@svx/di';

import { Component, ComponentDescriptor} from "@svx/service-common"
import {
  ComponentLocator,
  ServiceInstanceProvider,
} from '@svx/service-client';

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


@module({name: "infrastructure"})
class InfrastructureModule extends Module {
  @create()
  createConfigurationManager(): ConfigurationManager {
     console.log("create config sources")
    return new ConfigurationManager(new ValueConfigurationSource({
      "authentication": {
        "url": "http://localhost:8080",
        "realm":  "service",
        "clientId":  "service-browser"
      }
    }));
  }

  @onRunning()
  async startup(configurationManager: ConfigurationManager) {
    console.log("load config sources")
    await configurationManager.load()
  }
}

// main module

@module({ parent: InfrastructureModule})
class ApplicationModule extends Module {
  @create()
  createSessionManager(@config("authentication.url") url: string): SessionManager<any, any> {
    console.log(`authentication.url= ${url}`)
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
      localManifest: manifest as never,
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

const environment = await Environment.run({ module: ApplicationModule });

console.log(environment.report());

// testing

const service = environment.get<UserInventoryService>(UserInventoryService)
let all = await service.findAll();
await service.create({
  name: 'Andi',
  addresses: [{
    city: 'Cologne'
  }]
})

all = await service.findAll();

console.log(all)

// load local and remote manifests

const registry = environment.get(FeatureRegistry);
const deploymentManager = environment.get(DeploymentManager);

await deploymentManager.loadDeployment({
  application: 'portal',
  client: deploymentManager.clientInfo(),
});

// force loading of local components

await registry.bootComponents(import.meta.glob('./features/**/*.svelte')); // maybe subfolder is better

// report

console.log(environment.report());

// mount app

import './main.css';
import { URL } from 'url';

const { default: App } = await import('./App.svelte');

mount(App, {
  target: document.getElementById('app')!,
  props: {
    environment
  }
});
