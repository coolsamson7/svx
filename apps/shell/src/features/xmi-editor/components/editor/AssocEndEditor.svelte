<script lang="ts">
  import type { AssocEnd } from '../../model/types'
  import { store } from '../../model/store.svelte'
  import MultiplicityPicker from './MultiplicityPicker.svelte'

  interface Props {
    assocId: string
    endIdx: 0 | 1
    end: AssocEnd
    isFk: boolean
  }
  let { assocId, endIdx, end, isFk }: Props = $props()

  const CASCADE_OPTIONS = ['', 'true', 'insert', 'update', 'remove', 'insert,update', 'insert,update,remove']
  const ON_DELETE_OPTIONS = ['', 'CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION']

  const targetName = $derived(store.model.elements[end.typeId]?.name ?? end.typeId)

  function patch(field: keyof AssocEnd, value: string | boolean | undefined) {
    store.updateAssocEnd(assocId, endIdx, { [field]: value } as Partial<AssocEnd>)
  }
</script>

<div class="end-editor">
  <div class="end-title">
    <span class="arrow">→</span>
    <span class="target">{targetName}</span>
    {#if isFk}<span class="fk-badge">FK</span>{/if}
  </div>

  <div class="field">
    <label>Role (property name)</label>
    <input
      type="text"
      value={end.role}
      placeholder="(not navigable)"
      oninput={(e) => patch('role', (e.target as HTMLInputElement).value)}
    />
  </div>

  <div class="field">
    <label>Multiplicity</label>
    <MultiplicityPicker
      lower={end.lower}
      upper={end.upper}
      onchange={(l, u) => { patch('lower', l); patch('upper', u) }}
    />
  </div>

  <div class="field">
    <label class="check-label">
      <input
        type="checkbox"
        checked={end.navigable !== false}
        onchange={(e) => patch('navigable', (e.target as HTMLInputElement).checked)}
      />
      Generate accessor (navigable)
    </label>
  </div>

  {#if isFk}
    <div class="field">
      <label>Cascade (ORM)</label>
      <select
        value={end.cascade ?? ''}
        onchange={(e) => patch('cascade', (e.target as HTMLSelectElement).value || undefined)}
      >
        {#each CASCADE_OPTIONS as opt}
          <option value={opt}>{opt || '—'}</option>
        {/each}
      </select>
    </div>

    <div class="field">
      <label>On Delete (DB)</label>
      <select
        value={end.onDelete ?? ''}
        onchange={(e) => patch('onDelete', (e.target as HTMLSelectElement).value || undefined)}
      >
        {#each ON_DELETE_OPTIONS as opt}
          <option value={opt}>{opt || '—'}</option>
        {/each}
      </select>
    </div>
  {/if}
</div>

<style>
  .end-editor {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .end-title {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .arrow {
    font-size: 14px;
    color: #534AB7;
  }

  .target {
    font-weight: 700;
    font-size: 13px;
    color: #222;
    flex: 1;
  }

  .fk-badge {
    font-size: 10px;
    font-weight: 700;
    background: #534AB7;
    color: white;
    border-radius: 3px;
    padding: 1px 5px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  label {
    font-size: 11px;
    font-weight: 600;
    color: #666;
  }

  input[type="text"], select {
    padding: 4px 7px;
    font-size: 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fafafa;
  }

  input[type="text"]:focus, select:focus {
    outline: none;
    border-color: #534AB7;
    background: white;
  }

  .check-label {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 400;
    color: #444;
  }

  .check-label input { width: auto; cursor: pointer; }
</style>
