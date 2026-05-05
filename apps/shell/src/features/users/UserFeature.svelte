<!-- UserList.svelte -->
<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id:          'users',
      label:       'Users',
      permissions: [],//'admin', 'manager'],
      tags:        ['users', 'crud'],
      version:     '1.0.0',
    },
    () => import('./UserFeature.svelte')   // self-reference for lazy loading
  );
</script>

<script lang="ts">
  let { userId }: { userId?: number } = $props();
</script>

<div>Users</div>
