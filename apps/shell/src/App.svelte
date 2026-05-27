<script lang="ts">
  import { Environment } from '@svx/di';
  import { Feature, FeatureRegistry } from '@svx/portal';
  import { SessionManager } from '@svx/security';
  import EnvironmentProvider from './EnvironmentProvider.svelte';

  import { onMount } from "svelte"

  const { environment }: { environment: Environment } = $props();

  import { applyTheme } from './theme';

  onMount(() => {
      applyTheme('#6750a4', false); // your brand color
  });

  const sessionManager = environment.get(SessionManager)
  const featureRegistry = environment.get(FeatureRegistry)

  let hasSession = $state(sessionManager.hasSession());

  onMount(() => {
    const sub = sessionManager.events$.subscribe(event => {
      if (event.type === 'opened') hasSession = true;
      else if (event.type === 'closed') hasSession = false;
    });
    return () => sub.unsubscribe();
  });

  let portal = $derived(
    featureRegistry.finder()
      .withTag('portal')
      .withVisibility(hasSession ? "private" : "public")
      .findOne()
  );
</script>

<!-- the portal -->

<EnvironmentProvider environment={environment}>
{#if portal}
  <Feature id={portal.id} />
{:else}
  <div>No portal feature found</div>
{/if}
</EnvironmentProvider>


