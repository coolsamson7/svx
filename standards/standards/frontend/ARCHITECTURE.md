# Frontend architecture standards

## Overview

The frontend is a micro-frontend platform built on Svelte 5 and Module Federation. A **shell** app hosts the runtime and loads **remote** apps dynamically. Features are self-describing Svelte components that register themselves into the `FeatureRegistry` on load.

```
┌────────────────────────────────────────┐
│  shell (port 4200)                     │
│  ├── DI bootstrap (ApplicationModule) │
│  ├── FeatureRegistry                  │
│  ├── Router                           │
│  └── loads remotes at runtime ──────► │  remote (port 4201)
│                                        │  ├── exposes: ./App, ./Bar, …
└────────────────────────────────────────┘  └── features register via defineFeature()
```

## Shell app

The shell owns the runtime: DI container, router, session, and the module-federation host configuration.

### Bootstrap sequence (`main.ts`)

```typescript
import 'reflect-metadata'
import './shell.package'           // DeclareApplication registration
import './bootstrap/component-locator';

const environment = await Environment.run({ module: ApplicationModule });

const registry          = environment.get(FeatureRegistry);
const deploymentManager = environment.get(DeploymentManager);

await deploymentManager.loadDeployment({ application: 'portal', client: deploymentManager.clientInfo() });
await registry.bootComponents(import.meta.glob('./features/**/*.svelte'));
environment.get(RouterManager).buildRouter();

const { default: App } = await import('./App.svelte');
mount(App, { target: document.getElementById('app')!, props: { environment } });
```

Order matters: `reflect-metadata` and `shell.package` first, DI environment next, then deployment load, then local feature discovery, then router build, then mount.

### DI modules

Modules declare services via `@create()` factory methods and lifecycle hooks via `@onRunning()`.

```typescript
@module({ name: 'infrastructure' })
export class InfrastructureModule extends Module {
  @create()
  createConfigurationManager(): ConfigurationManager {
    return new ConfigurationManager(new ValueConfigurationSource({ ... }));
  }

  @onRunning()
  async startup(configurationManager: ConfigurationManager) {
    await configurationManager.load();
  }
}

@module({ parent: InfrastructureModule })
export class ApplicationModule extends Module {
  @create()
  createSessionManager(authService: OIDCAuthService): SessionManager { ... }

  @create()
  createDeploymentLoader(): DeploymentLoader {
    return new RemoteDeploymentLoader([{ name: 'remote', url: 'http://localhost:4201' }]);
  }

  @onRunning()
  async setup(sessionManager: SessionManager, routerManager: RouterManager) {
    const session = await sessionManager.start();
    if (session) routerManager.navigateAfterLogin();
    routerManager.useSecurityGuard(sessionManager);
  }
}
```

- `InfrastructureModule` — config, auth clients, infrastructure-only services. No business logic.
- `ApplicationModule` — session, deployment loader, error manager. Parent is `InfrastructureModule`.
- Constructor parameters in `@create()` methods are injected automatically by the DI container.
- `@onRunning()` methods run after all services are created; they receive injected arguments the same way.

### Shell vite.config.ts conventions

- Module federation `name: 'shell'`, no `filename` (host, not a remote).
- `shared` must include `svelte` (singleton) and `@svx/portal` (singleton).
- Use `swc.vite()` for decorator support (`syntax: 'typescript'`, `decorators: true`, `decoratorMetadata: true`).
- `oxc: false` — OXC is not used in the frontend build.
- Lib aliases (`@svx/common`, `@svx/portal`, etc.) point to `../../dist/libs/<name>/index.mjs`.
- `server.port: 4200` for the shell.

## Remote apps

A remote exposes one or more Svelte components via module federation. It has no DI bootstrap — it shares the shell's singletons (`svelte`, `@svx/portal`) through the federation runtime.

### Remote vite.config.ts conventions

```typescript
federation({
  name: 'remote',
  filename: 'remoteEntry.js',        // must be present on remotes
  exposes: {
    './App': './src/App.svelte',
    './Bar': './src/Bar.svelte',
  },
  shared: { svelte: { singleton: true }, '@svx/portal': { singleton: true } },
})
```

- `name` matches the key used in the shell's `DeploymentLoader` config.
- `base: 'http://localhost:<port>/'` — required so asset URLs are absolute (federation loads assets cross-origin).
- `server.cors: true` and `server.origin: 'http://localhost:<port>'` — required for federation.
- Each component listed in `exposes` can declare features; the shell discovers them at runtime.

## Features

A feature is a Svelte component that self-registers into the `FeatureRegistry` via `defineFeature()` in its `<script module>` block.

```svelte
<!-- features/user-list/UserList.svelte -->
<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id:          'user-list',
      label:       'Users',
      router:      { path: 'users' },
      permissions: ['admin'],
      tags:        ['navigation'],
      visibility:  ['private'],
    },
    () => import('./UserList.svelte')   // self-reference for lazy loading
  );
</script>

<script lang="ts">
  // component logic
</script>
```

- `id` is unique across the entire platform (shell + all remotes).
- `router.path` becomes the URL path segment: `users` → `/users`.
- `permissions` is an array of required permission strings; empty array means no restriction.
- `tags: ['navigation']` includes the feature in the nav menu.
- `visibility: ['private']` hides the feature when the user has no session; `['public']` shows it always.
- The loader (`() => import('./UserList.svelte')`) is a self-reference — the component lazily imports itself. This is the required pattern for code splitting.

### Feature file location

Features live in `src/features/<name>/<FeatureName>.svelte`. The shell discovers them with:
```typescript
import.meta.glob('./features/**/*.svelte')
```
Every `.svelte` file under `features/` is scanned; only files with a `defineFeature()` call register themselves.

### Feature data flow

Features receive data by getting services from the DI environment. The `EnvironmentProvider` component makes the environment available via Svelte context. Use `getContext` or the portal's `Feature` component to access it.

Do not pass services as props through the component tree. Get them from the environment at the top of the component that needs them.

## Svelte conventions

- Use **Svelte 5 runes** syntax: `$props()`, `$state()`, `$derived()`, `$effect()`.
- Declare prop types inline: `const { user }: { user: UserDto } = $props()`.
- No Options API (`export let`, `beforeUpdate`, etc.) — the codebase uses runes exclusively.
- Component files: PascalCase (`UserList.svelte`). Feature folders: kebab-case (`user-list/`).
- Keep components focused: one feature per file, sub-components in the same folder.

## Build and toolchain

- **SWC** handles TypeScript + legacy decorators. OXC is disabled (`oxc: false`) for frontend.
- The `descriptorPlugin()` (same as backend) runs on `.ts` files containing `Reflectable`, `DeclareService`, `DeclareComponent`.
- Built dist files are referenced via `alias` in vite config — do not import from `src/` across lib boundaries; always use the built output.
