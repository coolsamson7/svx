
<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature({
      id: 'bar',
      label: 'Bar',
      router: {
        path: 'bar'
      },
      permissions: [],
      tags:['navigation']
    }
  );
</script>

<script lang="ts">
  // normal per-instance script
</script>

<div>Bar from Remote!</div>
