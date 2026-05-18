<!-- UserList.svelte -->
<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id:          'pageNotFound',
      label:       'Page Not Found',
      router:      { path: 'unknown' },
      permissions: [],
      visibility:  ['public'],
      tags:        ['not-found'],
    },
    () => import('./PageNotFound.svelte')
  );
</script>

<script lang="ts">
  // normal per-instance script
</script>

<div>Page not found</div>
