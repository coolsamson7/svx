<script lang="ts">
  import { store } from '../../model/store.svelte'
  import { schema } from '../../model/schema'
  import FieldRenderer from './FieldRenderer.svelte'
  import AttributeList from './AttributeList.svelte'
  import TaggedValueEditor from './TaggedValueEditor.svelte'

  const el = $derived(store.selectedId ? store.model.elements[store.selectedId] : null)
  const elSchema = $derived(el ? schema[el.kind] : null)

  function getFieldValue(key: string): any {
    if (!el) return ''
    if (key === 'name') return el.name
    if (key.startsWith('tags.')) return el.tags[key.slice(5)] ?? ''
    if (key.startsWith('ends.')) {
      const [, idx, prop] = key.split('.')
      return (el as any).ends?.[Number(idx)]?.[prop] ?? ''
    }
    return ''
  }

  function setFieldValue(key: string, value: any) {
    if (!store.selectedId || !el) return
    if (key === 'name') {
      store.updateElement(store.selectedId, { name: String(value) })
      return
    }
    if (key.startsWith('tags.')) {
      const tag = key.slice(5)
      store.updateElement(store.selectedId, { tags: { ...el.tags, [tag]: String(value) } })
      return
    }
    if (key.startsWith('ends.')) {
      const [, idx, prop] = key.split('.')
      const ends = [...(el as any).ends] as any[]
      ends[Number(idx)] = { ...ends[Number(idx)], [prop]: String(value) }
      store.updateElement(store.selectedId, { ends } as any)
    }
  }

  function deleteSelected() {
    if (!store.selectedId) return
    if (confirm(`Delete ${el?.name ?? store.selectedId}?`)) {
      store.deleteElement(store.selectedId)
    }
  }
</script>

{#if el && elSchema}
  <div class="panel">
    <div class="panel-header">
      <span class="kind-badge">{el.kind.replace('uml:', '')}</span>
      <span class="panel-title">{el.name}</span>
      <button class="icon-btn danger" onclick={deleteSelected} title="Delete element">🗑</button>
      <button class="icon-btn" onclick={() => store.selectedId = null} title="Close">✕</button>
    </div>
    <div class="panel-body">
      {#each elSchema.fields as field}
        <div class="field-row">
          <label>{field.label}</label>
          <FieldRenderer
            {field}
            value={getFieldValue(field.key)}
            onchange={(v) => setFieldValue(field.key, v)}
          />
        </div>
      {/each}

      {#if el.kind === 'uml:Class' || el.kind === 'uml:DataType'}
        <div class="section-title">Attributes</div>
        <AttributeList elementId={el.id} attrs={el.attrs} />
      {/if}

      {#if elSchema.allowExtraTaggedValues}
        <div class="section-title">Tagged values</div>
        <TaggedValueEditor
          elementId={el.id}
          tags={el.tags}
          knownKeys={elSchema.fields.filter(f => f.key.startsWith('tags.')).map(f => f.key.slice(5))}
        />
      {/if}
    </div>
  </div>
{/if}

<style>
  .panel {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 300px;
    background: white;
    border-left: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    z-index: 10;
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.1);
    animation: slide-in 0.15s ease-out;
  }
  @keyframes slide-in {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  .panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid #e0e0e0;
    background: #f9f9f9;
  }
  .kind-badge {
    font-size: 10px;
    background: #EEEDFE;
    color: #534AB7;
    border-radius: 4px;
    padding: 2px 6px;
    font-weight: 600;
    white-space: nowrap;
  }
  .panel-title {
    flex: 1;
    font-weight: 600;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .icon-btn {
    border: none;
    background: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    color: #444;
  }
  .icon-btn:hover {
    background: #f0f0f0;
  }
  .icon-btn.danger:hover {
    background: #ffeeee;
    color: #c00;
  }
  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .field-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  label {
    font-size: 12px;
    font-weight: 500;
    color: #666;
  }
  .section-title {
    font-size: 12px;
    font-weight: 700;
    color: #333;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid #eee;
  }
</style>
