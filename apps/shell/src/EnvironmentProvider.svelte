<script lang="ts">
  import { setContext } from 'svelte';
  import { Environment } from '@svx/di';

  const { environment, children }: { environment: Environment; children?: any } = $props();
  
  // svelte-ignore state_referenced_locally

  console.log("set environment", environment)
  setContext('env', environment);
</script>

{#if children}
  {@render children()}
{/if}
