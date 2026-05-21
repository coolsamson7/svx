<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id:          'user',
      parent:      'users',
      label:       'User',
      router:      { path: ':id' },
      permissions: ['users:read'],
      tags:        [],
      version:     '1.0.0',
    },
    () => import('./UserFeature.svelte')
  );
</script>

<script lang="ts">
  import { getContext } from 'svelte';
  import { Environment } from '@svx/di';
  import { RouterManager } from '@svx/portal';
  import { findUser } from './users.store';

  const env           = getContext<Environment>('env');
  const routerManager = env.get(RouterManager);

  const id   = $derived(routerManager.route.params['id']);
  const user = $derived(id ? findUser(id) : undefined);
</script>

{#if user}
  <div class="user-card">
    <h2>{user.name}</h2>
    <dl>
      <dt>Email</dt><dd>{user.email}</dd>
      <dt>Role</dt> <dd>{user.role}</dd>
      <dt>ID</dt>   <dd>{user.id}</dd>
    </dl>
  </div>
{:else}
  <p class="not-found">User not found</p>
{/if}

<style>
  .user-card { padding: 0.5rem; }
  h2 { margin: 0 0 1rem; }
  dl { display: grid; grid-template-columns: 80px 1fr; gap: 0.5rem 1rem; align-items: baseline; }
  dt { font-weight: 600; color: var(--md-sys-color-outline, #666); font-size: 0.8rem; text-transform: uppercase; }
  .not-found { color: var(--md-sys-color-error, red); }
</style>
