<!-- UserList.svelte -->
<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id:          'home',
      label:       'Home',
      router: {
        path: "home"
      },
      permissions: [],
      visibility:  ['public'],
      tags:        ['navigation']
    },
    () => import('./Home.svelte')   // self-reference for lazy loading
  );
</script>

<script lang="ts">
  // normal per-instance script
</script>

<div>Welcome!</div>
