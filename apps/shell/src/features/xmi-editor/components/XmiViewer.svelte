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
  import PackageNode from './nodes/PackageNode.svelte'
  import AssocEdge from './edges/AssocEdge.svelte'
  import GenEdge from './edges/GenEdge.svelte'
  import EditorPanel from './editor/EditorPanel.svelte'
  import Toolbar from './toolbar/Toolbar.svelte'
  import UndoBar from './toolbar/UndoBar.svelte'
  import DropZone from './DropZone.svelte'
  import CompilePanel from './compile/CompilePanel.svelte'
  import PackageTree from './PackageTree.svelte'
  import XmiView from './XmiView.svelte'
  import FlowFocusOnSelect from './FlowFocusOnSelect.svelte'
  import ConfirmDialog from './ConfirmDialog.svelte'
  import { emitXmi } from '@svx/xmi'

  let showCompile = $state(false)
  let viewMode = $state<'viewer' | 'xmi'>('viewer')
  let pendingDeleteId = $state<string | null>(null)

  const xmiSource = $derived(emitXmi(store.model))

  const nodeTypes = {
    'uml:Class': ClassNode,
    'uml:DataType': DataTypeNode,
    'uml:PrimitiveType': PrimitiveNode,
    'uml:Package': PackageNode,
  }

  const edgeTypes = {
    'uml:Association': AssocEdge,
    'uml:Generalization': GenEdge,
  }

  let nodes: Node[] = $state.raw([])
  let edges: Edge[] = $state.raw([])

  $effect(() => {
    nodes = store.model.order
      .filter(id => {
        const k = store.model.elements[id]?.kind
        return k !== 'uml:Association' && k !== 'uml:PrimitiveType'
      })
      .map(id => {
        const el = store.model.elements[id]
        const pos = store.positions[id] ?? { x: 0, y: 0 }
        const node: Node = {
          id,
          type: el.kind,
          position: pos,
          data: { element: el },
          selected: store.selectedId === id,
          zIndex: el.kind === 'uml:Package' ? -1 : 1,
        }
        if (el.parentId) node.parentId = el.parentId
        if (el.kind === 'uml:Package') {
          const size = store.sizes[id]
          node.width = size?.width ?? 300
          node.height = size?.height ?? 200
          node.draggable = true
          node.selectable = true
        }
        return node
      })
  })

  $effect(() => {
    const assocEdges = store.model.order
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
      .filter(e => e.source && e.target
        && store.model.elements[e.source]
        && store.model.elements[e.target])

    const genEdges: Edge[] = store.model.order
      .filter(id => {
        const el = store.model.elements[id]
        return el?.baseType && store.model.elements[el.baseType]
      })
      .map(id => ({
        id: `gen_${id}`,
        type: 'uml:Generalization',
        source: id,
        target: store.model.elements[id]!.baseType!,
        selected: false,
      } satisfies Edge))

    edges = [...assocEdges, ...genEdges]
  })

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
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return
      const el = store.model.elements[store.selectedId]
      if (el) pendingDeleteId = store.selectedId
    }
  }

  const isEmpty = $derived(store.model.order.length === 0)

  // Selected element's package parent (for "add inside this package" UX)
  const selectedPackageId = $derived(() => {
    const sel = store.selectedId ? store.model.elements[store.selectedId] : null
    if (!sel) return null
    if (sel.kind === 'uml:Package') return store.selectedId
    if (sel.parentId && store.model.elements[sel.parentId]?.kind === 'uml:Package') return sel.parentId
    return null
  })
</script>

<svelte:window onkeydown={onKeydown} />

{#if pendingDeleteId}
  {@const el = store.model.elements[pendingDeleteId]}
  <ConfirmDialog
    message={`Delete ${el?.kind === 'uml:Package' ? `package "${el.name}" and all its contents` : (el?.name || pendingDeleteId)}?`}
    onConfirm={() => { store.deleteElement(pendingDeleteId!); pendingDeleteId = null }}
    onCancel={() => pendingDeleteId = null}
  />
{/if}

<div class="viewer">
  <div class="toolbar-row">
    <Toolbar selectedPackageId={selectedPackageId()} />
    <UndoBar />
    <div class="tb-sep"></div>
    <button
      class="tb-btn"
      class:active={showCompile}
      onclick={() => showCompile = !showCompile}
      disabled={store.model.order.length === 0}
      title="Compile model"
    >⚡ Compile</button>
  </div>
  <div class="canvas-area" class:with-panel={showCompile}>
    {#if isEmpty}
      <DropZone />
    {:else}
      <div class="mode-bar">
        <button
          class="mode-btn"
          class:active={viewMode === 'viewer'}
          onclick={() => viewMode = 'viewer'}
          title="Diagram Viewer"
        >
          <span class="material-symbols-rounded">hub</span>
        </button>
        <button
          class="mode-btn"
          class:active={viewMode === 'xmi'}
          onclick={() => viewMode = 'xmi'}
          title="XMI Source"
        >
          <span class="material-symbols-rounded">code</span>
        </button>
      </div>
      <div class="tree-sidebar">
        <PackageTree />
      </div>
      <div class="flow-area">
        {#if viewMode === 'xmi'}
          <XmiView xmi={xmiSource} />
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
            <FlowFocusOnSelect />
          </SvelteFlow>
          {#if store.selectedId}
            <EditorPanel />
          {/if}
        {/if}
        {#if showCompile}
          <div class="compile-panel">
            <CompilePanel onClose={() => showCompile = false} />
          </div>
        {/if}
      </div>
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
    display: flex;
    overflow: hidden;
  }
  .mode-bar {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px 4px;
    border-right: 1px solid #e0e0e0;
    background: #f6f8fa;
    flex-shrink: 0;
  }
  .mode-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: none;
    cursor: pointer;
    color: #57606a;
  }
  .mode-btn .material-symbols-rounded { font-size: 18px; }
  .mode-btn:hover { background: #e8ecf0; color: #24292f; }
  .mode-btn.active {
    background: #EEEDFE;
    border-color: #534AB7;
    color: #534AB7;
  }
  .tree-sidebar {
    width: 200px;
    flex-shrink: 0;
    overflow: hidden;
  }
  .flow-area {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
  .compile-panel {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 700px;
    z-index: 10;
    box-shadow: -4px 0 16px rgba(0,0,0,0.12);
  }
  .tb-sep {
    width: 1px;
    background: #e0e0e0;
    align-self: stretch;
    margin: 0 4px;
  }
  .tb-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    font-size: 13px;
    white-space: nowrap;
  }
  .tb-btn:hover:not(:disabled) {
    background: #f5f5ff;
    border-color: #534AB7;
    color: #534AB7;
  }
  .tb-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .tb-btn.active {
    background: #EEEDFE;
    border-color: #534AB7;
    color: #534AB7;
    font-weight: 600;
  }
</style>
