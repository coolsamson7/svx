<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id:          'unauthorized',
      label:       'Unauthorized',
      router:      { path: 'unauthorized' },
      permissions: [],
      visibility:  ['public'],
      tags:        ['unauthorized'],
    },
    () => import('./Unauthorized.svelte')
  );
</script>

<script lang="ts">
</script>

<div class="error-page">
  <span class="material-symbols-rounded">lock</span>
  <h2>Access Denied</h2>
  <p>You don't have permission to view this page.</p>
</div>

<style>
  .error-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 1rem;
    color: var(--md-sys-color-on-surface-variant);
  }

  .material-symbols-rounded {
    font-family: 'Material Symbols Rounded';
    font-size: 64px;
    font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 48;
  }

  h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  p {
    margin: 0;
    font-size: 0.95rem;
  }
</style>
