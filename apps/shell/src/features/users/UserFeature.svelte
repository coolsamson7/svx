<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id:          'user',
      parent:      'users',
      label:       'User',
      router:      { path: ':id' },
      permissions: ['users:read'],
      tags:        [],
      version:     '1.0.0',
    },
    () => import('./UserFeature.svelte')
  );
</script>

<script lang="ts">
  import { getContext } from 'svelte';
  import { Environment } from '@svx/di';
  import { RouterManager } from '@svx/portal';
  import { UserInventoryService } from '@svx/user-interface';
  import type { UserDto, AddressDto } from '@svx/user-interface';

  type DraftAddress = { id?: number; city: string };
  type Draft = { name: string; addresses: DraftAddress[] };

  const env         = getContext<Environment>('env');
  const routerMgr   = env.get(RouterManager);
  const userService = env.get(UserInventoryService);

  const id = $derived(routerMgr.route.params['id']);

  let original: UserDto | undefined = $state(undefined);
  let draft: Draft = $state({ name: '', addresses: [] });
  let loading = $state(false);
  let saving  = $state(false);
  let error: string | undefined = $state(undefined);

  const isDirty = $derived.by(() => {
    if (!original) return false;
    return (
      draft.name !== original.name ||
      JSON.stringify(draft.addresses) !== JSON.stringify(original.addresses)
    );
  });

  $effect(() => {
    const currentId = id;
    if (!currentId) { original = undefined; return; }
    loading = true;
    error = undefined;
    userService.findOne(+currentId).then(result => {
      original = result;
      draft = toDraft(result);
      loading = false;
    }).catch(e => {
      error = String(e);
      loading = false;
    });
  });

  function toDraft(u: UserDto): Draft {
    return {
      name: u.name,
      addresses: (u.addresses ?? []).map(a => ({ id: a.id, city: a.city })),
    };
  }

  function revert() {
    if (original) draft = toDraft(original);
  }

  async function save() {
    if (!original) return;
    saving = true;
    error = undefined;
    try {
      const updated = await userService.update({ ...original, ...draft, addresses: draft.addresses as AddressDto[] });
      original = updated;
      draft = toDraft(updated);
    } catch (e) {
      error = String(e);
    } finally {
      saving = false;
    }
  }

  function addAddress() {
    draft.addresses = [...draft.addresses, { city: '' }];
  }

  function removeAddress(index: number) {
    draft.addresses = draft.addresses.filter((_, i) => i !== index);
  }
</script>

{#if loading}
  <p>Loading...</p>
{:else if !original}
  <p class="not-found">User not found</p>
{:else}
  <div class="user-card">
    <div class="header">
      <h2>#{original.id}</h2>
      <div class="actions">
        <button class="revert" disabled={!isDirty || saving} onclick={revert}>Revert</button>
        <button class="save"   disabled={!isDirty || saving} onclick={save}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <dl>
      <dt>Name</dt>
      <dd>
        <input type="text" bind:value={draft.name} disabled={saving} />
      </dd>

      <dt>Addresses</dt>
      <dd>
        <ul class="address-list">
          {#each draft.addresses as address, i}
            <li>
              <input type="text" bind:value={address.city} disabled={saving} placeholder="City" />
              <button class="remove" disabled={saving} onclick={() => removeAddress(i)}>✕</button>
            </li>
          {/each}
        </ul>
        <button class="add" disabled={saving} onclick={addAddress}>+ Add address</button>
      </dd>
    </dl>
  </div>
{/if}

<style>
  .user-card { padding: 0.5rem; }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
  h2 { margin: 0; color: var(--md-sys-color-outline, #888); font-size: 0.9rem; font-weight: 400; }

  .actions { display: flex; gap: 0.5rem; }

  button {
    border: none;
    border-radius: 6px;
    padding: 0.35rem 0.8rem;
    cursor: pointer;
    font-size: 0.85rem;
  }
  button:disabled { opacity: 0.4; cursor: default; }

  .save   { background: var(--md-sys-color-primary, #6750a4); color: #fff; }
  .revert { background: var(--md-sys-color-surface-container, #eee); color: inherit; }

  dl {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: 0.75rem 1rem;
    align-items: start;
  }
  dt {
    font-weight: 600;
    color: var(--md-sys-color-outline, #666);
    font-size: 0.8rem;
    text-transform: uppercase;
    padding-top: 0.4rem;
  }

  input[type="text"] {
    border: 1px solid var(--md-sys-color-outline-variant, #ccc);
    border-radius: 6px;
    padding: 0.35rem 0.6rem;
    font: inherit;
    width: 100%;
    box-sizing: border-box;
  }
  input[type="text"]:focus { outline: 2px solid var(--md-sys-color-primary, #6750a4); border-color: transparent; }

  .address-list { list-style: none; padding: 0; margin: 0 0 0.4rem; display: flex; flex-direction: column; gap: 0.4rem; }
  .address-list li { display: flex; gap: 0.4rem; align-items: center; }
  .address-list input { flex: 1; }

  .remove {
    padding: 0.25rem 0.5rem;
    background: none;
    color: var(--md-sys-color-error, #b3261e);
    font-size: 0.8rem;
    flex-shrink: 0;
  }
  .add {
    background: none;
    color: var(--md-sys-color-primary, #6750a4);
    padding: 0.25rem 0;
    font-size: 0.85rem;
  }

  .not-found, .error { color: var(--md-sys-color-error, red); }
</style>
