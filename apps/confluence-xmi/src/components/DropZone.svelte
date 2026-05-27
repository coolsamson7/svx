<script lang="ts">
  import { store } from '../model/store.svelte'
  import { parseXmi } from '../parser/xmi-parser'
  import { layoutModel } from '../layout/elk-layout'

  let dragOver = $state(false)
  let loading = $state(false)
  let error = $state<string | null>(null)
  let fileInput: HTMLInputElement

  async function loadText(text: string) {
    loading = true
    error = null
    try {
      const model = parseXmi(text)
      if (model.order.length === 0) {
        error = 'No UML elements found in the file.'
        return
      }
      const positions = await layoutModel(model)
      store.load(model, positions)
    } catch (e) {
      console.error('XMI parse error', e)
      error = 'Failed to parse XMI. Make sure the file is a valid UML XMI document.'
    } finally {
      loading = false
    }
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault()
    dragOver = false
    const file = e.dataTransfer?.files?.[0]
    if (file) {
      loadText(await file.text())
      return
    }
    const text = e.dataTransfer?.getData('text/plain')
    if (text) loadText(text)
  }

  async function onPaste(e: ClipboardEvent) {
    const text = e.clipboardData?.getData('text/plain')
    if (text?.includes('xmi:XMI') || text?.includes('xmi:type')) {
      loadText(text)
    }
  }

  async function onFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      loadText(await file.text())
      ;(e.target as HTMLInputElement).value = ''
    }
  }
</script>

<svelte:window onpaste={onPaste} />

<div
  class="dropzone"
  class:over={dragOver}
  class:loading
  ondragover={e => { e.preventDefault(); dragOver = true }}
  ondragleave={() => dragOver = false}
  ondrop={onDrop}
  onclick={() => fileInput.click()}
  role="button"
  tabindex="0"
  onkeydown={e => e.key === 'Enter' && fileInput.click()}
>
  <input
    bind:this={fileInput}
    type="file"
    accept=".xmi,.xml"
    style="display:none"
    onchange={onFileChange}
  />

  {#if loading}
    <span class="dz-icon spin">↻</span>
    <p>Parsing and laying out model…</p>
  {:else}
    <span class="dz-icon">↑</span>
    <p>Drop a <code>.xmi</code> file here, paste XMI, or click to browse</p>
    {#if error}
      <p class="error">{error}</p>
    {/if}
  {/if}
</div>

<style>
  .dropzone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    cursor: pointer;
    color: #999;
    border: 2px dashed #ddd;
    border-radius: 12px;
    margin: 24px;
    transition: all 0.15s;
    user-select: none;
  }
  .dropzone.over {
    border-color: #534AB7;
    background: #f5f5ff;
    color: #534AB7;
  }
  .dropzone.loading {
    pointer-events: none;
    opacity: 0.7;
  }
  .dropzone:hover:not(.loading) {
    border-color: #aaa;
  }
  p {
    font-size: 15px;
    margin: 8px 0 0;
  }
  code {
    font-family: monospace;
    background: #f0f0f0;
    padding: 1px 4px;
    border-radius: 3px;
  }
  .error {
    color: #c00;
    font-size: 13px;
    background: #fff0f0;
    padding: 6px 12px;
    border-radius: 6px;
    margin-top: 12px;
    border: 1px solid #ffcccc;
  }
  .dz-icon {
    font-size: 48px;
    color: #ccc;
    display: block;
  }
  .dropzone.over .dz-icon { color: #534AB7; }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .spin {
    animation: spin 1s linear infinite;
  }
</style>
