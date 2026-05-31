<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte'
  import type { NodeProps } from '@xyflow/svelte'
  import type { UmlElement } from '../../model/types'
  import { store } from '../../model/store.svelte'
  import NodeDeleteButton from './NodeDeleteButton.svelte'

  let { data, id, selected }: NodeProps<{ element: UmlElement }> = $props()
  const el = $derived(store.model.elements[id] ?? data.element)
  const baseTypeName = $derived(el.baseType ? (store.model.elements[el.baseType]?.name ?? el.baseType) : null)
  const maxLength = $derived(el.tags['max-length'])
  const minLength = $derived(el.tags['min-length'])

  let nodeDescHovered = $state(false)
</script>

<Handle type="target" position={Position.Top} />
<div class="node datatype-node" class:selected>
  <NodeDeleteButton {id} name={el.name} kind={el.kind} {selected} />
  <div
    class="node-header"
    class:has-desc={!!el.description}
    onmouseenter={() => nodeDescHovered = true}
    onmouseleave={() => nodeDescHovered = false}
  >
    <div class="stereotype">«datatype»</div>
    <div class="type-name">{el.name}</div>
    {#if nodeDescHovered && el.description}
      <div class="desc-tooltip">{el.description}</div>
    {/if}
  </div>

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
    overflow: visible;
  }
  .node.selected {
    border-color: #0A4D3C;
    box-shadow: 0 0 0 3px rgba(15, 110, 86, 0.3);
  }
  .node-header {
    position: relative;
    border-radius: 6px 6px 0 0;
    transition: background 0.1s;
  }
  .node-header.has-desc {
    border-left: 3px solid rgba(15, 110, 86, 0.4);
  }
  .node-header.has-desc:hover {
    background: rgba(15, 110, 86, 0.07);
    border-left-color: #0F6E56;
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
  .attrs { padding: 4px 0; }
  .attr {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
  }
  .attr-name { font-weight: 500; }
  .attr-type { opacity: 0.7; font-size: 11px; }

  .desc-tooltip {
    position: absolute;
    bottom: calc(100% + 7px);
    left: 50%;
    transform: translateX(-50%);
    background: #0d2b22;
    color: #d0f0e6;
    padding: 5px 9px;
    border-radius: 5px;
    font-size: 11px;
    white-space: pre-wrap;
    max-width: 240px;
    z-index: 9999;
    pointer-events: none;
    box-shadow: 0 3px 10px rgba(0,0,0,0.35);
    line-height: 1.45;
    border: 1px solid rgba(15, 110, 86, 0.5);
  }
  .desc-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: #0d2b22;
  }
</style>
