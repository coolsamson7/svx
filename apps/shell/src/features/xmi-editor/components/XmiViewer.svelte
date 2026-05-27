<script lang="ts">
  import {
    SvelteFlow,
    Controls,
    Background,
    MiniMap,
    type Node,
    type Edge,
    type Connection,
  } from '@xyflow/svelte'
  import '@xyflow/svelte/dist/style.css'
  import { store } from '../model/store.svelte'
  import type { UmlAssociation } from '../model/types'
  import ClassNode from './nodes/ClassNode.svelte'
  import DataTypeNode from './nodes/DataTypeNode.svelte'
  import PrimitiveNode from './nodes/PrimitiveNode.svelte'
  import AssocEdge from './edges/AssocEdge.svelte'
  import EditorPanel from './editor/EditorPanel.svelte'
  import Toolbar from './toolbar/Toolbar.svelte'
  import UndoBar from './toolbar/UndoBar.svelte'
  import DropZone from './DropZone.svelte'

  const nodeTypes = {
    'uml:Class': ClassNode,
    'uml:DataType': DataTypeNode,
    'uml:PrimitiveType': PrimitiveNode,
  }

  const edgeTypes = {
    'uml:Association': AssocEdge,
  }

  const nodes = $derived(
    store.model.order
      .filter(id => store.model.elements[id]?.kind !== 'uml:Association')
      .map(id => {
        const el = store.model.elements[id]
        const pos = store.positions[id] ?? { x: 0, y: 0 }
        return {
          id,
          type: el.kind,
          position: pos,
          data: { element: el },
          selected: store.selectedId === id,
        } satisfies Node
      })
  )

  const edges = $derived(
    store.model.order
      .filter(id => store.model.elements[id]?.kind === 'uml:Association')
      .map(id => {
        const el = store.model.elements[id] as UmlAssociation
        return {
          id,
          type: 'uml:Association',
          source: el.ends[0].typeId,
          target: el.ends[1].typeId,
          data: { assoc: el },
          selected: store.selectedId === id,
        } satisfies Edge
      })
      .filter(e => e.source && e.target)
  )

  function onNodeClick({ node }: { node: Node }) {
    store.selectedId = node.id
  }

  function onPaneClick() {
    store.selectedId = null
  }

  function onNodeDragStop({ targetNode }: { targetNode: Node | null }) {
    if (targetNode) store.moveNode(targetNode.id, targetNode.position.x, targetNode.position.y)
  }

  function onEdgeClick({ edge }: { edge: Edge }) {
    store.selectedId = edge.id
  }

  function onConnect({ source, target }: Connection) {
    if (source && target && source !== target) store.addAssociation(source, target)
  }

  function onKeydown(e: KeyboardEvent) {
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    const mod = isMac ? e.metaKey : e.ctrlKey

    if (mod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      store.undo()
    }
    if (mod && (e.key === 'Z' || (e.shiftKey && e.key === 'z'))) {
      e.preventDefault()
      store.redo()
    }
    if (mod && e.key === 'y') {
      e.preventDefault()
      store.redo()
    }
    if (e.key === 'Escape') {
      store.selectedId = null
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && store.selectedId) {
      // Only delete if not focused on an input
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return
      const el = store.model.elements[store.selectedId]
      if (el && confirm(`Delete ${el.name || store.selectedId}?`)) {
        store.deleteElement(store.selectedId)
      }
    }
  }

  const isEmpty = $derived(store.model.order.length === 0)
</script>

<svelte:window onkeydown={onKeydown} />

<div class="viewer">
  <div class="toolbar-row">
    <Toolbar />
    <UndoBar />
  </div>
  <div class="canvas-area">
    {#if isEmpty}
      <DropZone />
    {:else}
      <SvelteFlow
        {nodes}
        {edges}
        {nodeTypes}
        {edgeTypes}
        onnodeclick={onNodeClick}
        onpaneclick={onPaneClick}
        onnodedragstop={onNodeDragStop}
        onedgeclick={onEdgeClick}
        onconnect={onConnect}
        fitView
      >
        <Controls />
        <Background />
        <MiniMap />
      </SvelteFlow>
      {#if store.selectedId}
        <EditorPanel />
      {/if}
    {/if}
  </div>
</div>

<style>
  .viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .toolbar-row {
    display: flex;
    gap: 8px;
    padding: 8px;
    border-bottom: 1px solid #e0e0e0;
    align-items: center;
    background: white;
    flex-shrink: 0;
  }
  .canvas-area {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
</style>
