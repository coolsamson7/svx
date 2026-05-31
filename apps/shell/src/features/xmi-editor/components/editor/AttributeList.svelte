<script lang="ts">
  import type { UmlAttribute } from '../../model/types'
  import { attributeSchema } from '../../model/schema'
  import FieldRenderer from './FieldRenderer.svelte'
  import { store } from '../../model/store.svelte'

  let { elementId, attrs }: { elementId: string; attrs: UmlAttribute[] } = $props()
  let dragIndex = $state<number | null>(null)
  let expandedId = $state<string | null>(null)

  function onDragStart(e: DragEvent, i: number) {
    dragIndex = i
    e.dataTransfer!.effectAllowed = 'move'
  }

  function onDrop(e: DragEvent, i: number) {
    if (dragIndex === null || dragIndex === i) return
    const newOrder = [...attrs]
    const [moved] = newOrder.splice(dragIndex, 1)
    newOrder.splice(i, 0, moved)
    store.reorderAttributes(elementId, newOrder)
    dragIndex = null
  }

  function deleteAttr(attrId: string) {
    store.deleteAttribute(elementId, attrId)
    if (expandedId === attrId) expandedId = null
  }

  function addAttr() {
    const id = `attr_${Date.now()}`
    store.addAttribute(elementId, { id, name: 'newAttr', typeId: '', tags: {} })
    expandedId = id
  }

  function getAttrFieldValue(attr: UmlAttribute, key: string): any {
    if (key === 'name') return attr.name
    if (key === 'description') return attr.description ?? ''
    if (key === 'typeId') return attr.typeId
    if (key.startsWith('tags.')) return attr.tags[key.slice(5)] ?? ''
    return ''
  }

  function setAttrFieldValue(attrId: string, key: string, value: any) {
    if (key === 'name') {
      store.updateAttribute(elementId, attrId, { name: String(value) })
      return
    }
    if (key === 'description') {
      store.updateAttribute(elementId, attrId, { description: String(value) || undefined })
      return
    }
    if (key === 'typeId') {
      store.updateAttribute(elementId, attrId, { typeId: String(value) })
      return
    }
    if (key.startsWith('tags.')) {
      const attr = attrs.find(a => a.id === attrId)
      if (!attr) return
      store.updateAttribute(elementId, attrId, { tags: { ...attr.tags, [key.slice(5)]: String(value) } })
    }
  }
</script>

<div class="attr-list">
  {#each attrs as attr, i (attr.id)}
    <div
      class="attr-row"
      class:dragging={dragIndex === i}
      draggable="true"
      ondragstart={e => onDragStart(e, i)}
      ondragover={e => e.preventDefault()}
      ondrop={e => onDrop(e, i)}
      ondragend={() => dragIndex = null}
    >
      <div
        class="attr-header"
        role="button"
        tabindex="0"
        onclick={() => expandedId = expandedId === attr.id ? null : attr.id}
        onkeydown={e => e.key === 'Enter' && (expandedId = expandedId === attr.id ? null : attr.id)}
      >
        <span class="drag-handle material-symbols-rounded">drag_indicator</span>
        <span class="attr-name">{attr.name}</span>
        <span class="attr-type-label">{store.model.elements[attr.typeId]?.name ?? attr.typeId}</span>
        {#if attr.tags['primary-key'] === 'true'}
          <span class="pk-badge">PK</span>
        {/if}
        <button
          class="icon-btn"
          onclick={(e) => { e.stopPropagation(); deleteAttr(attr.id) }}
          title="Remove attribute"
        >
          <span class="material-symbols-rounded" style="font-size:16px">close</span>
        </button>
      </div>
      {#if expandedId === attr.id}
        <div class="attr-fields">
          {#each attributeSchema as field}
            <div class="field-row">
              <label>{field.label}</label>
              <FieldRenderer
                {field}
                value={getAttrFieldValue(attr, field.key)}
                onchange={(v) => setAttrFieldValue(attr.id, field.key, v)}
              />
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
  <button class="add-attr-btn" onclick={addAttr}>
    <span class="material-symbols-rounded">add</span> Add attribute
  </button>
</div>

<style>
  .attr-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .attr-row {
    border: 1px solid #eee;
    border-radius: 4px;
    overflow: hidden;
  }
  .attr-row.dragging {
    opacity: 0.5;
  }
  .attr-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    cursor: pointer;
    background: #fafafa;
  }
  .attr-header:hover {
    background: #f0f0f0;
  }
  .drag-handle {
    font-size: 16px;
    color: #aaa;
    cursor: grab;
  }
  .attr-name {
    font-weight: 500;
    font-size: 13px;
    flex: 1;
  }
  .attr-type-label {
    font-size: 11px;
    color: #888;
  }
  .pk-badge {
    font-size: 10px;
    background: #EEEDFE;
    color: #534AB7;
    border-radius: 3px;
    padding: 1px 4px;
  }
  .icon-btn {
    border: none;
    background: none;
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    color: #888;
  }
  .icon-btn:hover {
    color: #c00;
  }
  .attr-fields {
    padding: 8px;
    background: white;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid #eee;
  }
  .field-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  label {
    font-size: 11px;
    color: #666;
  }
  .add-attr-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px;
    border: 1px dashed #ccc;
    border-radius: 4px;
    background: none;
    cursor: pointer;
    color: #666;
    font-size: 13px;
    width: 100%;
  }
  .add-attr-btn:hover {
    background: #f5f5ff;
    border-color: #534AB7;
    color: #534AB7;
  }
</style>
