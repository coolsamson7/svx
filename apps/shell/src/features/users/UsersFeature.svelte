<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id:          'users',
      label:       'Users',
      router:      { path: 'users' },
      permissions: ['users:read'],
      visibility:  ['public'],
      tags:        ['navigation'],
      version:     '1.0.0',
    },
    () => import('./UsersFeature.svelte')
  );
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getContext } from 'svelte';
  import { Environment } from '@svx/di';
  import { RouterManager } from '@svx/portal';
  import { USERS } from './users.store';

  let { children }: { children?: Snippet } = $props();

  const env           = getContext<Environment>('env');
  const routerManager = env.get(RouterManager);
</script>

<div class="users-layout">
  <aside class="user-list">
    <h2>Users</h2>
    <ul>
      {#each USERS as user}
        <li>
          <button
            class:active={routerManager.isActive(`/users/${user.id}`)}
            onclick={() => routerManager.navigate(`/users/${user.id}`)}
          >
            {user.name}
          </button>
        </li>
      {/each}
    </ul>
  </aside>

  <div class="user-detail">
    {#if children}
      {@render children()}
    {:else}
      <p class="placeholder">Select a user</p>
    {/if}
  </div>
</div>

<style>
  .users-layout {
    display: grid;
    grid-template-columns: 220px 1fr;
    height: 100%;
    gap: 1rem;
  }

  .user-list {
    border-right: 1px solid var(--md-sys-color-outline-variant, #ccc);
    padding-right: 1rem;
  }

  h2 { margin: 0 0 1rem; font-size: 1rem; font-weight: 600; }

  ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 4px; }

  button {
    background: none;
    border: none;
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    width: 100%;
    text-align: left;
    color: var(--md-sys-color-on-surface-variant, #333);
  }

  button:hover { background: var(--md-sys-color-surface-container, #f0f0f0); }
  button.active {
    background: var(--md-sys-color-secondary-container, #e8def8);
    color: var(--md-sys-color-on-secondary-container, #1d192b);
    font-weight: 600;
  }

  .user-detail { padding: 0 1rem; }

  .placeholder { color: var(--md-sys-color-outline, #999); font-style: italic; }
</style>
