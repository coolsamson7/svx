<!-- UserList.svelte -->
<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id:          'users',
      label:       'Users',
      router:      { path: 'users' },
      permissions: ['users:read'],
      tags:        ['navigation'],
      version:     '1.0.0',
    },
    () => import('./UserFeature.svelte')
  );
</script>

<script lang="ts">
  let { userId }: { userId?: number } = $props();
</script>

<div>Users</div>
