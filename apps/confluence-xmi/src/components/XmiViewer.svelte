<script lang="ts">
  import { store } from '../model/store.svelte'
  import SvgCanvas from './SvgCanvas.svelte'
  import EditorPanel from './editor/EditorPanel.svelte'
  import Toolbar from './toolbar/Toolbar.svelte'
  import UndoBar from './toolbar/UndoBar.svelte'
  import DropZone from './DropZone.svelte'

  function onKeydown(e: KeyboardEvent) {
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    const mod = isMac ? e.metaKey : e.ctrlKey

    if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); store.undo() }
    if (mod && (e.key === 'Z' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); store.redo() }
    if (mod && e.key === 'y') { e.preventDefault(); store.redo() }
    if (e.key === 'Escape') { store.selectedId = null }
    if ((e.key === 'Delete' || e.key === 'Backspace') && store.selectedId) {
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
      <SvgCanvas />
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
