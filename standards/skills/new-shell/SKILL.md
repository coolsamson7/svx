---
description: Scaffold a new Svelte shell app — sets up the module-federation host, DI bootstrap (InfrastructureModule + ApplicationModule), OIDC session, and deployment loader. Use when creating a new shell application from scratch.
---

## Context

Read before acting:
- `standards/frontend/ARCHITECTURE.md` — shell bootstrap sequence, DI module conventions, vite config

Replace `my-shell` / `MyShell` with the actual app name throughout.

---

## File structure

```
apps/my-shell/
  src/
    features/           ← feature components go here
    bootstrap/
      application.module.ts
      component-locator.ts
      infrastructure.module.ts
    App.svelte
    EnvironmentProvider.svelte
    main.ts
    shell.package.ts
    theme.ts            ← optional, for Material You theming
    main.css
    manifest.json       ← local feature manifest (usually empty array initially)
  package.json
  vite.config.ts
  svelte.config.js
  tsconfig.json
  index.html
```

---

## 1. `shell.package.ts`

```typescript
import pkg from '../package.json';
import { DeclareApplication, AbstractPackage } from '@svx/common';

@DeclareApplication({ name: pkg.name, version: pkg.version })
export class ShellPackage extends AbstractPackage {}
```

---

## 2. `bootstrap/infrastructure.module.ts`

```typescript
import { ConfigurationManager, ValueConfigurationSource } from '@svx/common';
import { Module, create, module, onRunning } from '@svx/di';

@module({ name: 'infrastructure' })
export class InfrastructureModule extends Module {
  @create()
  createConfigurationManager(): ConfigurationManager {
    return new ConfigurationManager(new ValueConfigurationSource({
      authentication: {
        url:      import.meta.env.VITE_KEYCLOAK_URL,
        realm:    import.meta.env.VITE_KEYCLOAK_REALM,
        clientId: import.meta.env.VITE_OIDC_CLIENT_ID,
      },
    }));
  }

  @onRunning()
  async startup(configurationManager: ConfigurationManager) {
    await configurationManager.load();
  }
}
```

---

## 3. `bootstrap/application.module.ts`

```typescript
import { catchError, ErrorManager } from '@svx/common';
import { OIDCUser, OIDCTicket, SessionManager } from '@svx/security';
import { OIDCAuthService } from '@svx/security-oidc';
import {
  DeploymentLoader, DeploymentManager, FeatureRegistry,
  ManifestProcessor, RemoteDeploymentLoader, RouterManager,
} from '@svx/portal';
import { Module, create, module, onRunning } from '@svx/di';
import { InfrastructureModule } from './infrastructure.module';
import manifest from '../manifest.json';

@module({ parent: InfrastructureModule })
export class ApplicationModule extends Module {
  @create()
  createSessionManager(authService: OIDCAuthService): SessionManager<void, OIDCUser, OIDCTicket> {
    return new SessionManager(authService);
  }

  @create()
  createErrorManager(): ErrorManager {
    const manager = new ErrorManager();
    manager.registerHandler(this);
    return manager;
  }

  @create()
  createDeploymentLoader(): DeploymentLoader {
    return new RemoteDeploymentLoader([
      { name: 'remote', url: import.meta.env.VITE_REMOTE_URL ?? 'http://localhost:4201' },
    ]);
  }

  @create()
  createDeploymentManager(loader: DeploymentLoader, featureRegistry: FeatureRegistry): DeploymentManager {
    return new DeploymentManager({
      featureRegistry,
      loader,
      localManifest: manifest as never,
      processor: new ManifestProcessor({ hasPermission: () => true, hasFeature: () => true }),
    });
  }

  @onRunning()
  async setup(
    sessionManager: SessionManager<void, OIDCUser, OIDCTicket>,
    routerManager: RouterManager,
  ): Promise<void> {
    const session = await sessionManager.start();
    if (session) routerManager.navigateAfterLogin();
    routerManager.useSecurityGuard(sessionManager);
  }

  @catchError()
  handle(error: any) {
    console.error(error);
  }
}
```

---

## 4. `bootstrap/component-locator.ts`

```typescript
import { Component, ComponentDescriptor } from '@svx/service-common';
import { ComponentLocator, ServiceInstanceProvider } from '@svx/service-client';
import { injectable } from '@svx/di';

@injectable()
export class StaticComponentLocator extends ComponentLocator {
  locate(_component: ComponentDescriptor<Component>): string {
    return import.meta.env.VITE_API_URL;
  }
}

ServiceInstanceProvider.registerServiceProviders();
```

---

## 5. `main.ts`

```typescript
import 'reflect-metadata'
import './shell.package'
import './bootstrap/component-locator';

import { configureOIDC } from '@svx/security-oidc';
import { Environment } from '@svx/di';
import { DeploymentManager, FeatureRegistry, RouterManager } from '@svx/portal';
import { mount } from 'svelte';
import { ApplicationModule } from './bootstrap/application.module';

configureOIDC({
  authority:                import.meta.env.VITE_OIDC_AUTHORITY,
  client_id:                import.meta.env.VITE_OIDC_CLIENT_ID,
  redirect_uri:             `${window.location.origin}/callback`,
  scope:                    import.meta.env.VITE_OIDC_SCOPE,
  post_logout_redirect_uri: window.location.origin,
});

const environment = await Environment.run({ module: ApplicationModule });

await environment.get(DeploymentManager).loadDeployment({
  application: 'portal',
  client:      environment.get(DeploymentManager).clientInfo(),
});

await environment.get(FeatureRegistry).bootComponents(import.meta.glob('./features/**/*.svelte'));
environment.get(RouterManager).buildRouter();

import './main.css';

const { default: App } = await import('./App.svelte');
mount(App, { target: document.getElementById('app')!, props: { environment } });
```

---

## 6. `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { federation } from '@module-federation/vite';
import swc from 'unplugin-swc';
import path from 'path';

export default defineConfig({
  root: __dirname,
  plugins: [
    federation({
      name: 'my-shell',
      dts: false,
      shared: {
        svelte:       { singleton: true, requiredVersion: '^5.0.0' },
        '@svx/portal': { singleton: true, requiredVersion: '*', import: '@svx/portal' },
      },
    }),
    svelte(),
    swc.vite({
      jsc: {
        target: 'es2022',
        parser:    { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true },
      },
    }),
  ],
  resolve: {
    alias: {
      '@svx/common':   path.resolve(__dirname, '../../dist/libs/common/index.mjs'),
      '@svx/di':       path.resolve(__dirname, '../../dist/libs/di/index.mjs'),
      '@svx/portal':   path.resolve(__dirname, '../../dist/libs/portal/index.mjs'),
      // add more as needed
    },
  },
  oxc: false,
  build: { target: 'esnext' },
  server: { port: 4200, fs: { allow: ['../..'] } },
});
```

---

## 7. `manifest.json`

```json
{ "id": "my-shell", "label": "My Shell", "version": "0.0.1", "loaded": false, "generated": "", "features": [] }
```

---

## Checklist

- [ ] `reflect-metadata` is the first import in `main.ts`
- [ ] `shell.package.ts` is imported before `Environment.run()`
- [ ] `component-locator.ts` side-effect import is before `Environment.run()`
- [ ] `configureOIDC()` is called before `Environment.run()`
- [ ] `bootComponents()` uses `import.meta.glob('./features/**/*.svelte')`
- [ ] `buildRouter()` called after `bootComponents()`
- [ ] Vite config has `oxc: false`
- [ ] `svelte` and `@svx/portal` are declared as `singleton` in federation `shared`
- [ ] App mounted after dynamic `import('./App.svelte')` (avoids SSR issues with federation)
