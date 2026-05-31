<script lang="ts">
  import FileTree from './FileTree.svelte'
  import CodeViewer from './CodeViewer.svelte'

  interface Props {
    schemas: Map<string, string> | undefined
    entities: Map<string, string> | undefined
  }

  let { schemas, entities }: Props = $props()

  let selectedPath = $state<string | null>(null)

  const allFiles = $derived((): Map<string, string> => {
    const merged = new Map<string, string>()
    for (const [k, v] of (schemas ?? new Map())) merged.set(`schemas/${k}`, v)
    for (const [k, v] of (entities ?? new Map())) merged.set(`entities/${k}`, v)
    return merged
  })

  const selectedContent = $derived(selectedPath ? allFiles().get(selectedPath) ?? null : null)

  $effect(() => {
    const first = allFiles().keys().next().value
    selectedPath = first ?? null
  })
</script>

<div class="ts-output">
  <div class="split">
    <div class="tree-pane">
      <FileTree
        files={allFiles()}
        selected={selectedPath}
        onSelect={(p) => selectedPath = p}
        label="typescript"
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
