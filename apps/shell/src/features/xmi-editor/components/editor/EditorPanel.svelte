<script lang="ts">
  import { store } from '../../model/store.svelte'
  import { schema } from '../../model/schema'
  import FieldRenderer from './FieldRenderer.svelte'
  import AttributeList from './AttributeList.svelte'
  import TaggedValueEditor from './TaggedValueEditor.svelte'
  import ConfirmDialog from '../ConfirmDialog.svelte'
  import AssocPanel from './AssocPanel.svelte'
  import AssocEndEditor from './AssocEndEditor.svelte'
  import type { UmlAssociation, AssocEnd } from '../../model/types'

  let confirmDelete = $state(false)
  let expandedRelId = $state<string | null>(null)

  const el = $derived(store.selectedId ? store.model.elements[store.selectedId] : null)
  const elSchema = $derived(el ? schema[el.kind] : null)

  /** Associations that involve the currently selected class (one end's typeId === el.id) */
  const classRelations = $derived(
    (el?.kind === 'uml:Class')
      ? Object.values(store.model.elements).filter(
          (e): e is UmlAssociation =>
            e.kind === 'uml:Association' &&
            ((e as UmlAssociation).ends[0].typeId === el.id || (e as UmlAssociation).ends[1].typeId === el.id)
        )
      : []
  )

  function relEndFor(assoc: UmlAssociation): { end: AssocEnd; idx: 0 | 1; other: AssocEnd } {
    // Return the end pointing TO the other class (typeId ≠ current class) — that end carries
    // the role/multiplicity that belongs to the current class's navigation property.
    if (assoc.ends[0].typeId !== el!.id) return { end: assoc.ends[0], idx: 0, other: assoc.ends[1] }
    return { end: assoc.ends[1], idx: 1, other: assoc.ends[0] }
  }

  function isFkEnd(end: AssocEnd, other: AssocEnd): boolean {
    const otherIsMany = other.upper === '*' || other.upper === '-1' || Number(other.upper) > 1
    return end.upper === '1' && otherIsMany
  }

  function getFieldValue(key: string): any {
    if (!el) return ''
    if (key === 'name') return el.name
    if (key === 'description') return el.description ?? ''
    if (key === 'baseType') return el.baseType ?? ''
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
    if (key === 'description') {
      store.updateElement(store.selectedId, { description: String(value) || undefined })
      return
    }
    if (key === 'baseType') {
      store.updateElement(store.selectedId, { baseType: String(value) || undefined })
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
    confirmDelete = true
  }

  function doDelete() {
    if (store.selectedId) store.deleteElement(store.selectedId)
    confirmDelete = false
  }
</script>

{#if confirmDelete}
  <ConfirmDialog
    message={`Delete ${el?.kind === 'uml:Package' ? `package "${el.name}" and all its contents` : (el?.name || store.selectedId)}?`}
    onConfirm={doDelete}
    onCancel={() => confirmDelete = false}
  />
{/if}

{#if el && elSchema}
  <div class="panel">
    <div class="panel-header">
      <span class="kind-badge">{el.kind.replace('uml:', '')}</span>
      <span class="panel-title">{el.name}</span>
      <button class="icon-btn danger" onclick={deleteSelected} title="Delete element">
        <span class="material-symbols-rounded">delete</span>
      </button>
      <button class="icon-btn" onclick={() => store.selectedId = null} title="Close">
        <span class="material-symbols-rounded">close</span>
      </button>
    </div>
    <div class="panel-body">
      {#if el.kind === 'uml:Association'}
        <AssocPanel assoc={el as UmlAssociation} />
      {:else}
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
          <AttributeList elementId={el.id} attrs={el.attrs.filter(a => !a.isAssociationEnd)} />
        {/if}

        {#if el.kind === 'uml:Class' && classRelations.length > 0}
          <div class="section-title">Relations</div>
          <div class="rel-list">
            {#each classRelations as assoc (assoc.id)}
              {@const { end, idx, other } = relEndFor(assoc)}
              {@const fk = isFkEnd(end, other)}
              {@const otherName = store.model.elements[end.typeId]?.name ?? end.typeId}
              <div class="rel-row" class:fk-row={fk}>
                <div
                  class="rel-header"
                  role="button"
                  tabindex="0"
                  onclick={() => expandedRelId = expandedRelId === assoc.id ? null : assoc.id}
                  onkeydown={(e) => e.key === 'Enter' && (expandedRelId = expandedRelId === assoc.id ? null : assoc.id)}
                >
                  <span class="rel-arrow">→</span>
                  <span class="rel-target">{otherName}</span>
                  {#if end.role}<span class="rel-role">.{end.role}</span>{/if}
                  <span class="rel-mult">[{end.lower}..{end.upper}]</span>
                  {#if fk}<span class="fk-badge">FK</span>{/if}
                </div>
                {#if expandedRelId === assoc.id}
                  <div class="rel-body">
                    <AssocEndEditor
                      assocId={assoc.id}
                      endIdx={idx}
                      {end}
                      isFk={fk}
                    />
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        {#if elSchema.allowExtraTaggedValues}
          <div class="section-title">Tagged values</div>
          <TaggedValueEditor
            elementId={el.id}
            tags={el.tags}
            knownKeys={elSchema.fields.filter(f => f.key.startsWith('tags.')).map(f => f.key.slice(5))}
          />
        {/if}
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

  .rel-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .rel-row {
    border: 1px solid #e0e0ff;
    border-radius: 4px;
    overflow: hidden;
    background: #fafafe;
  }

  .rel-row.fk-row {
    border-color: #c8c4f0;
  }

  .rel-header {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 8px;
    cursor: pointer;
  }

  .rel-header:hover { background: #f0eefc; }

  .rel-arrow { color: #534AB7; font-size: 13px; }

  .rel-target { font-weight: 600; font-size: 13px; color: #222; flex: 1; }

  .rel-role { font-size: 12px; color: #534AB7; }

  .rel-mult { font-size: 11px; color: #888; font-family: monospace; }

  .fk-badge {
    font-size: 10px;
    font-weight: 700;
    background: #534AB7;
    color: white;
    border-radius: 3px;
    padding: 1px 5px;
  }

  .rel-body {
    padding: 10px 12px;
    background: white;
    border-top: 1px solid #e0e0ff;
  }
</style>
