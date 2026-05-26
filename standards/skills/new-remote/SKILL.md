---
description: Scaffold a new Svelte remote app — sets up module-federation with exposed components, correct CORS and base URL config, and shared singleton setup. Use when creating a new micro-frontend remote that the shell will load dynamically.
---

## Context

Read before acting:
- `standards/frontend/ARCHITECTURE.md` — remote conventions, federation config, feature registration

Replace `my-remote` / `4201` with the actual app name and port throughout.

---

## File structure

```
apps/my-remote/
  src/
    App.svelte          ← default exposed component (entry point)
    main.ts             ← standalone dev server entry (no federation bootstrap)
  package.json
  vite.config.ts
  svelte.config.js
  tsconfig.json
  index.html
```

Add more components under `src/` as needed and list them in `exposes`.

---

## 1. `src/App.svelte` — exposed component with feature registration

```svelte
<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id:         'my-remote-home',
      label:      'My Remote',
      router:     { path: 'my-remote' },
      permissions: [],
      tags:       ['navigation'],
      visibility: ['private'],
    },
    () => import('./App.svelte')   // self-reference for lazy loading
  );
</script>

<script lang="ts">
  // component logic
</script>

<div>My Remote App</div>
```

Every exposed component that should appear as a routed feature must call `defineFeature()` in its `<script module>` block.

---

## 2. `src/main.ts` — standalone dev entry (not used by federation)

```typescript
import App from './App.svelte';
import { mount } from 'svelte';

mount(App, { target: document.getElementById('app')! });
```

This is only used when running the remote in isolation (`vite dev`). The shell loads the remote via `remoteEntry.js`, not `main.ts`.

---

## 3. `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { federation } from '@module-federation/vite';
import swc from 'unplugin-swc';
import path from 'path';

export default defineConfig({
  root: __dirname,
  base: 'http://localhost:4201/',          // must be absolute — assets load cross-origin

  plugins: [
    federation({
      name: 'my-remote',
      filename: 'remoteEntry.js',          // shell fetches this to load the remote
      exposes: {
        './App': './src/App.svelte',       // key must start with './'
      },
      dts: false,
      shared: {
        svelte:        { singleton: true, requiredVersion: '^5.0.0' },
        '@svx/portal': { singleton: true, requiredVersion: '*', import: '@svx/portal' },
      },
    }),
    svelte(),
    swc.vite({
      jsc: {
        parser:    { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true },
      },
    }),
  ],

  resolve: {
    mainFields: ['module', 'browser', 'main'],
    alias: {
      '@svx/common': path.resolve(__dirname, '../../dist/libs/common/index.mjs'),
      '@svx/di':     path.resolve(__dirname, '../../dist/libs/di/index.mjs'),
      '@svx/portal': path.resolve(__dirname, '../../dist/libs/portal/index.mjs'),
    },
  },

  server: {
    port:       4201,
    strictPort: true,
    cors:       true,
    origin:     'http://localhost:4201',   // required for federation asset URLs
    fs: { allow: ['../..'] },
  },

  optimizeDeps: {
    exclude: ['@svx/portal'],
  },

  oxc: false,

  build: {
    target:       'esnext',
    minify:       false,
    cssCodeSplit: false,                   // single CSS file avoids cross-origin issues
  },
});
```

---

## 4. Register the remote in the shell

In the shell's `ApplicationModule`, add the remote URL to `createDeploymentLoader`:

```typescript
@create()
createDeploymentLoader(): DeploymentLoader {
  return new RemoteDeploymentLoader([
    { name: 'my-remote', url: import.meta.env.VITE_MY_REMOTE_URL ?? 'http://localhost:4201' },
  ]);
}
```

The `name` must match the `name` field in the remote's `federation()` config.

---

## Checklist

- [ ] `base` in vite config is the absolute URL (not `/`)
- [ ] `filename: 'remoteEntry.js'` is present in `federation()`
- [ ] `server.cors: true` and `server.origin` match the port
- [ ] `svelte` and `@svx/portal` are `singleton: true` in `shared`
- [ ] `oxc: false`
- [ ] Every exposed component that is a routed feature calls `defineFeature()` in `<script module>`
- [ ] Remote name registered in the shell's `DeploymentLoader`
