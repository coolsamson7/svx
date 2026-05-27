<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte'
  import type { NodeProps } from '@xyflow/svelte'
  import type { UmlElement } from '../../model/types'
  import { store } from '../../model/store.svelte'

  let { data, id, selected }: NodeProps<{ element: UmlElement }> = $props()
  const el = $derived(store.model.elements[id] ?? data.element)
</script>

<Handle type="target" position={Position.Top} />
<div class="node primitive-node" class:selected>
  <div class="stereotype">«primitive»</div>
  <div class="prim-name">{el.name}</div>
</div>
<Handle type="source" position={Position.Bottom} />

<style>
  .node {
    background: #F1EFE8;
    border: 2px solid #5F5E5A;
    border-radius: 8px;
    min-width: 140px;
    font-family: system-ui, sans-serif;
    font-size: 13px;
    color: #3A3935;
    box-shadow: 0 2px 8px rgba(95, 94, 90, 0.12);
  }
  .node.selected {
    border-color: #3A3935;
    box-shadow: 0 0 0 3px rgba(95, 94, 90, 0.3);
  }
  .stereotype {
    font-size: 11px;
    text-align: center;
    opacity: 0.65;
    padding: 4px 8px 0;
    font-style: italic;
  }
  .prim-name {
    font-weight: 700;
    text-align: center;
    padding: 4px 8px 8px;
    font-size: 14px;
  }
</style>
