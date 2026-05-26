---
description: Add a new routed feature (page) to an existing shell or remote app — creates the Svelte component with defineFeature() registration and wires up routing, permissions, and navigation. Use when asked to add a new page, screen, or section to the frontend.
---

## Context

Read before acting:
- `standards/frontend/ARCHITECTURE.md` — feature registration, defineFeature() conventions, Svelte 5 runes

---

## Where features live

- In the **shell**: `apps/<shell>/src/features/<feature-name>/<FeatureName>.svelte`
- In a **remote**: `apps/<remote>/src/<FeatureName>.svelte` (and listed in `exposes` in vite.config)

The shell discovers all `.svelte` files under `features/` automatically via `import.meta.glob`. Remote features are discovered when the shell loads the remote's `remoteEntry.js`.

---

## Feature component template

```svelte
<!-- features/user-list/UserList.svelte  (or  src/UserList.svelte  in a remote) -->
<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id:          'user-list',          // globally unique across shell + all remotes
      label:       'Users',             // shown in navigation
      router:      { path: 'users' },   // URL: /users
      permissions: ['admin'],           // [] = no restriction
      tags:        ['navigation'],      // include in nav menu
      visibility:  ['private'],         // 'private' = requires session, 'public' = always
    },
    () => import('./UserList.svelte')   // self-reference — enables code splitting
  );
</script>

<script lang="ts">
  import { getContext } from 'svelte';
  import type { Environment } from '@svx/di';

  // Get services from the DI environment (provided by EnvironmentProvider in the shell)
  const environment = getContext<Environment>('environment');
  // const userService = environment.get(UserInventoryService);
</script>

<div>
  <!-- feature content -->
</div>
```

---

## `defineFeature()` fields

| Field         | Required | Description |
|---------------|----------|-------------|
| `id`          | yes      | Globally unique string. Use `kebab-case`. |
| `label`       | yes      | Display name in navigation. |
| `router.path` | yes      | URL path segment (no leading slash). |
| `permissions` | yes      | Required permissions. `[]` = open to all. |
| `tags`        | no       | `['navigation']` to appear in nav menu. |
| `visibility`  | no       | `['private']` (needs session), `['public']` (always). Default: private. |
| `parent`      | no       | ID of a parent feature (for nested routes). |

---

## Nested / child features

For sub-routes (`/users/:id`), declare a child feature with `parent` pointing to the parent's `id`:

```svelte
<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id:     'user-detail',
      parent: 'user-list',             // nests under /users
      label:  'User Detail',
      router: { path: ':id' },         // → /users/:id
      permissions: ['admin'],
      tags:   [],                      // no nav entry for child routes
    },
    () => import('./UserDetail.svelte')
  );
</script>
```

---

## Accessing services in a feature

Services are provided by the `EnvironmentProvider` component in the shell root via Svelte context. Use `getContext` at the top of the `<script lang="ts">` block.

```svelte
<script lang="ts">
  import { getContext } from 'svelte';
  import type { Environment } from '@svx/di';
  import type { UserInventoryService } from '@svx/user-interface';

  const environment = getContext<Environment>('environment');
  const service = environment.get(UserInventoryService as any);

  let users = $state<any[]>([]);

  async function load() {
    users = await service.findAll();
  }
</script>
```

Do not pass the environment or services as props through parent components.

---

## For a remote: also add to `exposes`

If the feature is in a remote app, add the component to `exposes` in `vite.config.ts`:

```typescript
exposes: {
  './App':      './src/App.svelte',
  './UserList': './src/UserList.svelte',   // ← add this
},
```

---

## Checklist

- [ ] `id` is unique across all apps (search the codebase before picking one)
- [ ] `defineFeature()` is in `<script module>`, not `<script lang="ts">`
- [ ] Loader is a self-reference: `() => import('./FeatureName.svelte')`
- [ ] `tags: ['navigation']` if the feature should appear in the nav menu
- [ ] Services accessed via `getContext('environment')`, not as props
- [ ] If in a remote: component is listed in `exposes` in vite.config
- [ ] Uses Svelte 5 runes (`$state`, `$derived`, `$props`) — not Options API
