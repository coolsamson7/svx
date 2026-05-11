<script lang="ts">
  import { setContext } from 'svelte';
  import { Environment } from './di';

  const { environment, children }: { environment: Environment; children: any } = $props();
  
  // svelte-ignore state_referenced_locally
  setContext('environment', environment);
</script>

{@render children()}
