<script lang="ts">
  import FileTree from './FileTree.svelte'
  import CodeViewer from './CodeViewer.svelte'

  interface Props {
    schemas: Map<string, string> | undefined
    entities: Map<string, string> | undefined
  }

  let { schemas, entities }: Props = $props()

  let selectedPath = $state<string | null>(null)
  let activeGroup = $state<'schemas' | 'entities'>('schemas')

  const currentFiles = $derived(activeGroup === 'schemas' ? (schemas ?? new Map()) : (entities ?? new Map()))
  const selectedContent = $derived(selectedPath ? currentFiles.get(selectedPath) ?? null : null)

  $effect(() => {
    // Auto-select first file when switching groups
    const first = currentFiles.keys().next().value
    selectedPath = first ?? null
  })
</script>

<div class="ts-output">
  <div class="group-tabs">
    <button class:active={activeGroup === 'schemas'} onclick={() => { activeGroup = 'schemas' }}>
      Schemas ({schemas?.size ?? 0})
    </button>
    <button class:active={activeGroup === 'entities'} onclick={() => { activeGroup = 'entities' }}>
      Entities ({entities?.size ?? 0})
    </button>
  </div>

  <div class="split">
    <div class="tree-pane">
      <FileTree
        files={currentFiles}
        selected={selectedPath}
        onSelect={(p) => selectedPath = p}
        label={activeGroup}
      />
    </div>
    <div class="code-pane">
      {#if selectedContent}
        <div class="file-path">{selectedPath}</div>
        <CodeViewer code={selectedContent} language="typescript" />
      {:else}
        <div class="empty">Select a file from the tree</div>
      {/if}
    </div>
  </div>
</div>

<style>
  .ts-output {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .group-tabs {
    display: flex;
    gap: 2px;
    padding: 6px 8px 0;
    border-bottom: 1px solid #e0e0e0;
    background: white;
    flex-shrink: 0;
  }
  .group-tabs button {
    padding: 4px 12px;
    border: 1px solid #d0d7de;
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    background: #f6f8fa;
    cursor: pointer;
    font-size: 12px;
    color: #57606a;
    translate: 0 1px;
  }
  .group-tabs button.active {
    background: white;
    color: #24292f;
    font-weight: 600;
    border-color: #e0e0e0;
    border-bottom-color: white;
  }
  .split {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
  .tree-pane {
    width: 220px;
    flex-shrink: 0;
    overflow: hidden;
  }
  .code-pane {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .file-path {
    padding: 4px 12px;
    font-size: 11px;
    color: #57606a;
    background: #f6f8fa;
    border-bottom: 1px solid #e0e0e0;
    font-family: monospace;
    flex-shrink: 0;
  }
  .empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #57606a;
    font-size: 13px;
  }
</style>
