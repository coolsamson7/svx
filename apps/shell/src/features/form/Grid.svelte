<script lang="ts">
  import Render from './Render.svelte';
  import type { GridNode } from './types';

  let { node }: { node: GridNode } = $props();
</script>

<div class="grid" style="grid-template-columns: repeat({node.columns}, 1fr);">
  {#each node.children as child}
    <div style="
      grid-row: {child.cell?.row};
      grid-column: {child.cell?.col};
      grid-row-end: span {child.cell?.rowSpan ?? 1};
      grid-column-end: span {child.cell?.colSpan ?? 1};
    ">
      <Render node={child} />
    </div>
  {/each}
</div>

<style>
  .grid { display: grid; gap: 8px; }
</style>