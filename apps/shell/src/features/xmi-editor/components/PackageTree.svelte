<script lang="ts">
  import { store } from '../model/store.svelte'
  import type { UmlElement } from '../model/types'

  interface TreeNode {
    el: UmlElement
    children: TreeNode[]
  }

  const tree = $derived((): TreeNode[] => {
    const model = store.model
    const nodeMap = new Map<string, TreeNode>()
    const roots: TreeNode[] = []

    for (const id of model.order) {
      const el = model.elements[id]
      if (!el || el.kind === 'uml:Association') continue
      nodeMap.set(id, { el, children: [] })
    }

    for (const [, node] of nodeMap) {
      if (node.el.parentId && nodeMap.has(node.el.parentId)) {
        nodeMap.get(node.el.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    return roots
  })

  const kindIcon: Record<string, string> = {
    'uml:Class': 'category',
    'uml:DataType': 'data_object',
    'uml:PrimitiveType': 'circle',
    'uml:Package': 'folder',
  }

  let collapsed = $state(new Set<string>())

  function toggle(id: string) {
    collapsed = new Set(
      collapsed.has(id) ? [...collapsed].filter(x => x !== id) : [...collapsed, id]
    )
  }
</script>

<div class="pkg-tree">
  <div class="tree-header">Model Tree</div>
  <div class="tree-body">
    {#snippet renderNode(node: TreeNode, depth: number)}
      {@const el = node.el}
      {@const isPkg = el.kind === 'uml:Package'}
      {@const isCollapsed = collapsed.has(el.id)}
      {@const isSelected = store.selectedId === el.id}
      <div
        class="tree-node"
        class:selected={isSelected}
        style="padding-left: {8 + depth * 16}px"
        role="button"
        tabindex="0"
        onclick={() => store.selectedId = el.id}
        onkeydown={e => e.key === 'Enter' && (store.selectedId = el.id)}
      >
        {#if isPkg}
          <button
            class="caret"
            onclick={(e) => { e.stopPropagation(); toggle(el.id) }}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <span class="material-symbols-rounded">{isCollapsed ? 'chevron_right' : 'expand_more'}</span>
          </button>
        {:else}
          <span class="caret-space"></span>
        {/if}
        <span class="node-icon material-symbols-rounded">{kindIcon[el.kind] ?? 'radio_button_unchecked'}</span>
        <span class="node-label">{el.name || '(unnamed)'}</span>
      </div>
      {#if isPkg && !isCollapsed}
        {#each node.children as child}
          {@render renderNode(child, depth + 1)}
        {/each}
      {/if}
    {/snippet}

    {#each tree() as node}
      {@render renderNode(node, 0)}
    {/each}

    {#if tree().length === 0}
      <div class="empty">No elements</div>
    {/if}
  </div>
</div>

<style>
  .pkg-tree {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: white;
    border-right: 1px solid #e0e0e0;
    font-size: 12px;
  }
  .tree-header {
    padding: 8px 10px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #57606a;
    border-bottom: 1px solid #e0e0e0;
    background: #f6f8fa;
    flex-shrink: 0;
  }
  .tree-body {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }
  .tree-node {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-top: 3px;
    padding-bottom: 3px;
    padding-right: 8px;
    cursor: pointer;
    border-radius: 4px;
    margin: 0 4px;
    color: #24292f;
    user-select: none;
  }
  .tree-node:hover {
    background: #f0f0f0;
  }
  .tree-node.selected {
    background: #EEEDFE;
    color: #534AB7;
  }
  .caret {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    color: inherit;
    flex-shrink: 0;
  }
  .caret .material-symbols-rounded {
    font-size: 16px;
  }
  .caret-space {
    width: 18px;
    flex-shrink: 0;
  }
  .node-icon {
    font-size: 14px;
    opacity: 0.7;
    flex-shrink: 0;
  }
  .node-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .empty {
    padding: 16px;
    color: #888;
    font-style: italic;
    text-align: center;
  }
</style>
