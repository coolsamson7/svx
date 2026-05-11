<script lang="ts">
  import { Environment, inject } from '@svx/di';
  import { FeatureRegistry } from '@svx/portal';
  import { getContext, type Component } from 'svelte';

  type State =
    | { status: 'loading' }
    | { status: 'ready';  component: Component }
    | { status: 'error';  message: string }
    | { status: 'denied' }
    | { status: 'missing' };

  let { id, permissions = [], props = {} }: {
    id:           string;
    permissions?: string[];
    props?:       Record<string, any>;
  } = $props();

  const env      = getContext<Environment>('env');
  const registry = inject(env, FeatureRegistry);

  let state: State = $state({ status: 'loading' });

  $effect(() => { load(id); });

  async function load(featureId: string) {
    state = { status: 'loading' };

    const meta = registry.getFeature(featureId);
    if (!meta) { state = { status: 'missing' }; return; }

    if (!registry.hasPermission(featureId, permissions)) {
      state = { status: 'denied' }; return;
    }

    try {
      const component = await registry.resolveComponent(featureId);
      state = { status: 'ready', component };
    } catch(e) {
      state = { status: 'error', message: String(e) };
    }
  }
</script>

{#if state.status === 'loading'}
  <span>Loading...</span>
{:else if state.status === 'missing'}
  <span>Unknown feature: {id}</span>
{:else if state.status === 'denied'}
  <!-- silent -->
{:else if state.status === 'error'}
  <span>Error: {state.message}</span>
{:else if state.status === 'ready'}
  <state.component {...props} />
{/if}
