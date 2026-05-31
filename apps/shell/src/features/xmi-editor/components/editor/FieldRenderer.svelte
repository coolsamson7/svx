<script lang="ts">
  import type { FieldDef } from '../../model/schema'
  import TypeTreePicker from './TypeTreePicker.svelte'

  let { field, value, onchange }: { field: FieldDef; value: any; onchange: (v: any) => void } = $props()
</script>

{#if field.type === 'boolean'}
  <input
    type="checkbox"
    checked={value === 'true' || value === true}
    onchange={e => onchange(String((e.target as HTMLInputElement).checked))}
  />
{:else if field.type === 'number'}
  <input
    type="number"
    value={value}
    onchange={e => onchange((e.target as HTMLInputElement).value)}
  />
{:else if field.type === 'select'}
  <select value={value} onchange={e => onchange((e.target as HTMLSelectElement).value)}>
    <option value="">—</option>
    {#each field.options ?? [] as opt}
      <option value={opt}>{opt}</option>
    {/each}
  </select>
{:else if field.type === 'ref'}
  <TypeTreePicker value={value} targets={field.targets ?? []} onchange={onchange} />
{:else}
  <input
    type="text"
    value={value}
    oninput={e => onchange((e.target as HTMLInputElement).value)}
  />
{/if}

<style>
  input[type="text"],
  input[type="number"],
  select {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
    box-sizing: border-box;
  }
  input[type="text"]:focus,
  input[type="number"]:focus,
  select:focus {
    outline: none;
    border-color: #534AB7;
  }
</style>
