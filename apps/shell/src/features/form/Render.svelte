<script lang="ts">
  import { registry } from './registry';

  const { node }: { node: any } = $props();

  const Component = registry[node.type as keyof typeof registry];
</script>

{#if Component}
  <Component {node} />
{:else}
  <pre>Unknown node: {node.type}</pre>
{/if}