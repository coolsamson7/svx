import 'reflect-metadata'

import {
  ConfigurationManager,
  ConsoleTrace,
  TraceLevel,
  Tracer,
  TypeDescriptor,
  ValueConfigurationSource,
} from '@svx/common';

import { SessionManager } from '@svx/security';

import reflection from '../../api/services.json';

TypeDescriptor.loadReflection(reflection as any);
TypeDescriptor.mergeChildDecorators('UserInventoryServiceController', 'UserInventoryService');

import {
  Environment,
  module,
  onRunning,
  Module,
  injectable,
  create,
} from '@svx/di';

import { Component, ComponentDescriptor } from '@svx/service-common';
import { ComponentLocator, ServiceInstanceProvider, ServiceClient } from '@svx/service-client';

import {
  DeploymentLoader,
  DeploymentManager,
  FeatureRegistry,
  RouterManager,
  ManifestProcessor,
  RemoteDeploymentLoader,
} from '@svx/portal';

import { configureAuth, AuthModule, AuthService } from '@svx/auth';
import { initAuthStore } from './features/auth/auth.store.svelte';
import { mount } from 'svelte';

new Tracer({
  enabled: true,
  trace: new ConsoleTrace('%d [%p]: %m\n'),
  paths: {
    di:          TraceLevel.FULL,
    router:      TraceLevel.FULL,
    portal:      TraceLevel.FULL,
    application: TraceLevel.FULL,
  }
});

// configure OIDC before the environment starts
configureAuth({
  authority:                 import.meta.env.VITE_OIDC_AUTHORITY,
  client_id:                 import.meta.env.VITE_OIDC_CLIENT_ID,
  redirect_uri:              window.location.origin + '/callback',
  scope:                     import.meta.env.VITE_OIDC_SCOPE ?? 'openid profile email',
  post_logout_redirect_uri:  window.location.origin,
});

export const applicationConfig = {
  deployment: 'local',
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

@module({ imports: [AuthModule] })
class ApplicationModule extends Module {
  @create()
  createConfigurationManager(): ConfigurationManager {
    return new ConfigurationManager(new ValueConfigurationSource({}));
  }

  @create()
  createDeploymentLoader(): DeploymentLoader {
    return new RemoteDeploymentLoader([]);
  }

  @create()
  createDeploymentManager(loader: DeploymentLoader, featureRegistry: FeatureRegistry): DeploymentManager {
    return new DeploymentManager({
      featureRegistry: featureRegistry,
      loader: loader,
      localManifest: {
        generated: '',
        loaded: false,
        id: '',
        label: '',
        version: '',
        features: [],
      },
      processor: new ManifestProcessor({
        hasFeature: (_feature) => true,
        hasPermission: (_permission) => true,
      }),
    });
  }

  @onRunning()
  async setup(): Promise<void> {
    console.log('ApplicationModule.setup');
  }
}

@injectable()
export class StaticComponentLocator extends ComponentLocator {
  locate(_component: ComponentDescriptor<Component>): string {
    return 'http://localhost:3000/api';
  }
}

// register providers for the service proxies

ServiceInstanceProvider.registerServiceProviders();

// start environment — AuthModule.init() resolves session / processes callback here

const environment = new Environment({ module: ApplicationModule });
await environment.start();

console.log(environment.report());

// wire @svx/security SessionManager → @svx/portal permission filtering

const sessionManager = environment.get(SessionManager);
initAuthStore(sessionManager);
const registry       = environment.get(FeatureRegistry);

// Tags listed here act as feature flags — the user must have a Keycloak role
// with the same name to see any feature carrying that tag.
// To add a new flag: add the tag here + create the matching role in Keycloak.
const featureFlagTags = new Set(['navigation', 'crud', 'beta']);

registry.setPermissionChecker((feature) => {
  const visibility = feature.visibility;
  const requiresSession = visibility != null && !visibility.includes('public');

  if (!requiresSession)             return true;
  if (!sessionManager.hasSession()) return false;

  const roles = new Set(sessionManager.currentSession().user.roles as string[]);

  // feature-flag check: tag name must appear in user's roles
  for (const tag of (feature.tags ?? [])) {
    if (featureFlagTags.has(tag) && !roles.has(tag)) return false;
  }

  // explicit per-feature permission check
  const permissions = feature.permissions ?? [];
  return permissions.every(p => roles.has(p));
});

// route guard — re-checks the same permission logic at navigation time,
// catching direct URL access that bypasses the feature registry filter

const routerManager = environment.get(RouterManager);
const authService   = environment.get(AuthService);

routerManager.setGuard(async (feature) => {
  if (registry.checkPermission(feature)) return;  // allowed — proceed

  if (!sessionManager.hasSession()) {
    await authService.login();  // triggers OIDC redirect — page leaves
  } else {
    // logged in but missing the required role — go back to home
    throw routerManager.navigate('/home');
  }
});
const serviceClient = environment.get(ServiceClient);
serviceClient.setTokenProvider(authService);

// load manifests and boot accessible components

await registry.loadManifests(
  '/manifest.json',
  // 'http://localhost:4201/manifest.json',  // remote micro-frontend
);
await registry.bootComponents(import.meta.glob('./features/**/*.svelte'));

// mount app

import './main.css';

const { default: App } = await import('./App.svelte');

mount(App, {
  target: document.getElementById('app')!,
  props: { environment },
});
