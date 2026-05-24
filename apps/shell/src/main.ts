import 'reflect-metadata'
import './shell.package'

import { PackageRegistry } from '@svx/common'

if (import.meta.env.DEV)
  (window as any).packages = () => PackageRegistry.report()

import { ConsoleTrace, TraceLevel, Tracer } from '@svx/common';
import { configureOIDC } from '@svx/security-oidc';
import { Environment } from '@svx/di';
import { DeploymentManager, FeatureRegistry, RouterManager } from '@svx/portal';
import { mount } from 'svelte';
import '@svx/user-interface';
import './bootstrap/component-locator';
import { ApplicationModule } from './bootstrap/application.module';

new Tracer({
  enabled: true,
  trace: new ConsoleTrace('%d [%p]: %m\n'),
  paths: {
    di: TraceLevel.FULL,
    router: TraceLevel.FULL,
    portal: TraceLevel.FULL,
    application: TraceLevel.FULL,
  },
});

configureOIDC({
  authority:                import.meta.env.VITE_OIDC_AUTHORITY,
  client_id:                import.meta.env.VITE_OIDC_CLIENT_ID,
  redirect_uri:             `${window.location.origin}/callback`,
  scope:                    import.meta.env.VITE_OIDC_SCOPE,
  post_logout_redirect_uri: window.location.origin,
});

const environment = await Environment.run({ module: ApplicationModule });

const registry          = environment.get(FeatureRegistry);
const deploymentManager = environment.get(DeploymentManager);

await deploymentManager.loadDeployment({
  application: 'portal',
  client:      deploymentManager.clientInfo(),
});

await registry.bootComponents(import.meta.glob('./features/**/*.svelte'));
environment.get(RouterManager).buildRouter();

import './main.css';

const { default: App } = await import('./App.svelte');

mount(App, {
  target: document.getElementById('app')!,
  props: { environment },
});
