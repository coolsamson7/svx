<script module>
  import { defineFeature } from '@svx/portal';
  defineFeature(
    {
      id: 'xmi-editor',
      label: 'XMI Editor',
      router: { path: 'xmi-editor' },
      permissions: [],
      tags: ['navigation'],
      visibility: ['public']
    },
    () => import('./XmiEditorFeature.svelte')
  );
</script>

<script lang="ts">
  import XmiViewer from './components/XmiViewer.svelte'
</script>

<div style="height: 100%; overflow: hidden;">
  <XmiViewer />
</div>
