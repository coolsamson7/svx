<script lang="ts">
  import { Environment } from '@svx/di';
  import { Feature, FeatureRegistry } from '@svx/portal';
  import EnvironmentProvider from './EnvironmentProvider.svelte';

  import { onMount } from "svelte"

  const { environment }: { environment: Environment } = $props();

  import { applyTheme } from './theme';

  onMount(() => {
      applyTheme('#6750a4', false); // your brand color
  });

  console.log(environment)

  // svelte-ignore state_referenced_locally

  const portal = environment
    .get(FeatureRegistry)
    .findFeatures((f) => f.tags.includes("portal")).at(0)
</script>

<!-- the portal -->

<EnvironmentProvider environment={environment}>
{#if portal}
  <Feature id={portal.id} />
{:else}
  <div>No portal feature found</div>
{/if}
</EnvironmentProvider>


