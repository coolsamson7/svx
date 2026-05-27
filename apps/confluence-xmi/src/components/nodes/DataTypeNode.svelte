<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte'
  import type { NodeProps } from '@xyflow/svelte'
  import type { UmlElement } from '../../model/types'
  import { store } from '../../model/store.svelte'

  let { data, id, selected }: NodeProps<{ element: UmlElement }> = $props()
  const el = $derived(store.model.elements[id] ?? data.element)
  const baseTypeName = $derived(el.baseType ? (store.model.elements[el.baseType]?.name ?? el.baseType) : null)
  const maxLength = $derived(el.tags['max-length'])
  const minLength = $derived(el.tags['min-length'])
</script>

<Handle type="target" position={Position.Top} />
<div class="node datatype-node" class:selected>
  <div class="stereotype">«datatype»</div>
  <div class="type-name">{el.name}</div>
  {#if baseTypeName || maxLength || minLength}
    <div class="divider"></div>
    <div class="constraints">
      {#if baseTypeName}
        <div class="constraint-row">
          <span class="constraint-label">extends</span>
          <span class="constraint-value">{baseTypeName}</span>
        </div>
      {/if}
      {#if minLength}
        <div class="constraint-row">
          <span class="constraint-label">min</span>
          <span class="constraint-value">{minLength}</span>
        </div>
      {/if}
      {#if maxLength}
        <div class="constraint-row">
          <span class="constraint-label">max</span>
          <span class="constraint-value">{maxLength}</span>
        </div>
      {/if}
    </div>
  {/if}
  {#if el.attrs.length > 0}
    <div class="divider"></div>
    <div class="attrs">
      {#each el.attrs as attr}
        <div class="attr">
          <span class="attr-name">{attr.name}</span>
          <span class="attr-type">: {store.model.elements[attr.typeId]?.name ?? attr.typeId}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>
<Handle type="source" position={Position.Bottom} />

<style>
  .node {
    background: #E1F5EE;
    border: 2px solid #0F6E56;
    border-radius: 8px;
    min-width: 180px;
    font-family: system-ui, sans-serif;
    font-size: 13px;
    color: #0A4D3C;
    box-shadow: 0 2px 8px rgba(15, 110, 86, 0.15);
  }
  .node.selected {
    border-color: #0A4D3C;
    box-shadow: 0 0 0 3px rgba(15, 110, 86, 0.3);
  }
  .stereotype {
    font-size: 11px;
    text-align: center;
    opacity: 0.7;
    padding: 4px 8px 0;
    font-style: italic;
  }
  .type-name {
    font-weight: 700;
    text-align: center;
    padding: 4px 8px 8px;
    font-size: 14px;
  }
  .divider {
    border-top: 1.5px solid #0F6E56;
  }
  .constraints {
    padding: 4px 0;
  }
  .constraint-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 10px;
  }
  .constraint-label {
    font-size: 11px;
    opacity: 0.65;
    font-style: italic;
  }
  .constraint-value {
    font-weight: 500;
    font-size: 12px;
  }
  .attrs {
    padding: 4px 0;
  }
  .attr {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
  }
  .attr-name {
    font-weight: 500;
  }
  .attr-type {
    opacity: 0.7;
    font-size: 11px;
  }
</style>
