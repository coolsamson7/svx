<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte'
  import type { NodeProps } from '@xyflow/svelte'
  import type { UmlElement } from '../../model/types'
  import { store } from '../../model/store.svelte'
  import NodeDeleteButton from './NodeDeleteButton.svelte'

  let { data, id, selected }: NodeProps<{ element: UmlElement }> = $props()
  const el = $derived(store.model.elements[id] ?? data.element)
  const tableName = $derived(el.tags['table-name'])

  let nodeDescHovered = $state(false)
  let hoveredAttrId = $state<string | null>(null)
</script>

<Handle type="target" position={Position.Top} />
<div class="node class-node" class:selected>
  <NodeDeleteButton {id} name={el.name} kind={el.kind} {selected} />

  <div
    class="node-header"
    class:has-desc={!!el.description}
    onmouseenter={() => nodeDescHovered = true}
    onmouseleave={() => nodeDescHovered = false}
  >
    {#if tableName}
      <div class="stereotype">«table: {tableName}»</div>
    {/if}
    <div class="class-name">{el.name}</div>
    {#if nodeDescHovered && el.description}
      <div class="desc-tooltip">{el.description}</div>
    {/if}
  </div>

  {#if el.attrs.length > 0}
    <div class="divider"></div>
    <div class="attrs">
      {#each el.attrs as attr}
        {@const isPK = attr.tags['primary-key'] === 'true'}
        <div
          class="attr"
          class:has-desc={!!attr.description}
          class:hovered={hoveredAttrId === attr.id}
          onmouseenter={() => hoveredAttrId = attr.id}
          onmouseleave={() => hoveredAttrId = null}
        >
          {#if isPK}<span class="key-icon">🔑</span>{/if}
          {#if attr.isAssociationEnd}<span class="nav-icon">↗</span>{/if}
          <span class="attr-name">{attr.name}</span>
          <span class="attr-type">: {store.model.elements[attr.typeId]?.name ?? attr.typeId}</span>
          {#if hoveredAttrId === attr.id && attr.description}
            <div class="desc-tooltip">{attr.description}</div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
<Handle type="source" position={Position.Bottom} />

<style>
  .node {
    background: #EEEDFE;
    border: 2px solid #534AB7;
    border-radius: 8px;
    min-width: 180px;
    font-family: system-ui, sans-serif;
    font-size: 13px;
    color: #3C3489;
    box-shadow: 0 2px 8px rgba(83, 74, 183, 0.15);
    overflow: visible;
  }
  .node.selected {
    border-color: #3C3489;
    box-shadow: 0 0 0 3px rgba(83, 74, 183, 0.3);
  }
  .node-header {
    position: relative;
    border-radius: 6px 6px 0 0;
    transition: background 0.1s;
  }
  .node-header.has-desc {
    border-left: 3px solid rgba(83, 74, 183, 0.35);
  }
  .node-header.has-desc:hover {
    background: rgba(83, 74, 183, 0.08);
    border-left-color: #534AB7;
  }
  .stereotype {
    font-size: 11px;
    text-align: center;
    opacity: 0.7;
    padding: 4px 8px 0;
    font-style: italic;
  }
  .class-name {
    font-weight: 700;
    text-align: center;
    padding: 4px 8px 8px;
    font-size: 14px;
  }
  .divider {
    border-top: 1.5px solid #534AB7;
  }
  .attrs {
    padding: 4px 0;
  }
  .attr {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
    transition: background 0.1s;
  }
  .attr.has-desc {
    border-left: 3px solid rgba(83, 74, 183, 0.3);
    padding-left: 8px;
  }
  .attr.has-desc:hover,
  .attr.has-desc.hovered {
    background: #e0ddff;
    border-left-color: #534AB7;
  }
  .key-icon { font-size: 11px; }
  .nav-icon { font-size: 11px; opacity: 0.6; }
  .attr-name { font-weight: 500; }
  .attr-type { opacity: 0.7; font-size: 11px; }

  .desc-tooltip {
    position: absolute;
    bottom: calc(100% + 7px);
    left: 50%;
    transform: translateX(-50%);
    background: #1a1a2e;
    color: #e8e6ff;
    padding: 5px 9px;
    border-radius: 5px;
    font-size: 11px;
    white-space: pre-wrap;
    max-width: 240px;
    z-index: 9999;
    pointer-events: none;
    box-shadow: 0 3px 10px rgba(0,0,0,0.35);
    line-height: 1.45;
    border: 1px solid rgba(83, 74, 183, 0.5);
  }
  .desc-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: #1a1a2e;
  }
</style>
