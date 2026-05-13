<!-- UserList.svelte -->
<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id: 'users',
      label: 'Users',
      permissions: ['users:read'],
      tags: ['navigation', 'crud'],
      router: { path: 'users' },
      version: '1.0.0',
      visibility: ['private'],
    },
    () => import('./UserFeature.svelte'),
  );
</script>

<script lang="ts">
  let { userId }: { userId?: number } = $props();
</script>

<div>Users</div>
