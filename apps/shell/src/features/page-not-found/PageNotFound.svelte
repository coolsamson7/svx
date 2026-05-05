<!-- UserList.svelte -->
<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id:          'pageNotFound',
      label:       'Page Not Found',
      router: {
        path: "unknown"
      },
      permissions: [],//'admin', 'manager'],
      tags:        []
    },
    () => import('./PageNotFound.svelte')   // self-reference for lazy loading
  );
</script>

<script lang="ts">
  // normal per-instance script
</script>

<div>Page not found</div>
