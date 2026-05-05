<script lang="ts">
  import type { ButtonNode } from './types';
  import { Button } from 'm3-svelte';

  let { node }: { node: ButtonNode } = $props();

  function handleClick() {
    if (node.onClick) {
      console.log('action:', node.onClick);
    }
  }
</script>

<Button
  variant={node.variant ?? 'filled'}
  leadingIcon={node.icon}
  onclick={handleClick}
>
  {node.text}
</Button>
