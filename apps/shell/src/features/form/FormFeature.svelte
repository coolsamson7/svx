<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id:          'form',
      label:       'Form',
      router: {
        path: "form"
      },
      permissions: [],//'admin', 'manager'],
      tags:        ["navigation"]
    },
    () => import('./FormFeature.svelte')   // self-reference for lazy loading
  );
</script>

<script lang="ts">
    import Render from "./Render.svelte"
    
    const schema = {
          type: 'grid',
          children: [
            { type: 'button', text: 'Hello', cell: { "row": 1, "col": 1 }},
            { type: 'button', text: 'World', cell: { "row": 1, "col": 2 }},
          ]
      };
</script>

<Render node={schema} />
