<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id:          'callback',
      label:       'Callback',
      router:      { path: '/callback' },
      permissions: [],
      tags:        ['public'],
      _source:     { file: 'features/auth/Callback.svelte', line: 1 },
    },
    () => import('./Callback.svelte')
  );
</script>

<p>Signing in...</p>
