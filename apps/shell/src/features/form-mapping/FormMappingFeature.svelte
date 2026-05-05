<script module>
  import { defineFeature } from '@svx/portal';

  defineFeature(
    {
      id:          'form-mapping',
      label:       'Databinding',
      router:      { path: 'form-mapping' },
      permissions: [],
      tags:        ['navigation'],
    },
    () => import('./FormMappingFeature.svelte')
  );
</script>

<script lang="ts">
  import { TextField, Button, Switch } from 'm3-svelte';
  import { createForm } from './formMapper.svelte';
  import { type User } from './user.model';

  const model: User = {
    id: 1,
    name: 'Andi',
    address: {
      city: 'Cologne',
      street: 'Neumarkt',
    },
  };

  const form = createForm<User>(model);
  const user = form.values;
</script>

<div class="form-page">
  <h2 class="form-title">User</h2>

<div class="form-fields">
    <label class="field">
      <span class="field-label">Street</span>
      <input class="field-input" bind:value={user.address.street} />
    </label>
    <label class="field">
      <span class="field-label">City</span>
      <input class="field-input" bind:value={user.address.city} />
    </label>
  </div>

  {#if form.isDirty}
    <p class="dirty-hint">
      <span class="material-symbols-rounded">edit</span>
      Unsaved changes
    </p>
  {/if}

  <div class="form-actions">
    <Button variant="outlined" leadingIcon="restart_alt" onclick={form.reset} disabled={!form.isDirty}>
      Reset
    </Button>
    <Button variant="filled" leadingIcon="save" disabled={!form.isDirty}>
      Save
    </Button>
  </div>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');

  .form-page {
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .form-title {
    font-family: var(--md-sys-typescale-headline-small-font, system-ui);
    font-size: var(--md-sys-typescale-headline-small-size, 1.5rem);
    font-weight: 400;
    color: var(--md-sys-color-on-surface);
    margin: 0;
  }

  .form-fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .dirty-hint {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 0.875rem;
    color: var(--md-sys-color-tertiary);
  }

  .dirty-hint span {
    font-family: 'Material Symbols Rounded';
    font-size: 18px;
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
  }

  .form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .field-label {
      font-family: var(--md-sys-typescale-body-small-font, system-ui);
      font-size: 0.75rem;
      font-weight: 500;
      color: var(--md-sys-color-on-surface-variant);
      letter-spacing: 0.025em;
    }

    .field-input {
      height: 48px;
      padding: 0 16px;
      border: 1px solid var(--md-sys-color-outline);
      border-radius: 4px;
      background: transparent;
      color: var(--md-sys-color-on-surface);
      font-size: 1rem;
      outline: none;
      transition: border-color 200ms ease, box-shadow 200ms ease;
    }

    .field-input:hover {
      border-color: var(--md-sys-color-on-surface);
    }

    .field-input:focus {
      border-color: var(--md-sys-color-primary);
      border-width: 2px;
      box-shadow: 0 0 0 0px transparent;
    }
</style>
