<script lang="ts">
  import { store } from '../../model/store.svelte'
  import { parseXmi } from '../../parser/xmi-parser'
  import { emitXmi } from '@svx/xmi'
  import { layoutModel } from '../../layout/elk-layout'

  interface Props { selectedPackageId: string | null }
  let { selectedPackageId }: Props = $props()

  let algorithm = $state('layered')
  let fileInput: HTMLInputElement
  let importing = $state(false)
  let layouting = $state(false)

  const algorithms = ['layered', 'mrtree', 'force', 'rectpacking']

  async function importFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    importing = true
    try {
      const text = await file.text()
      const model = parseXmi(text)
      const { positions, sizes } = await layoutModel(model, algorithm)
      store.load(model, positions, sizes)
    } catch (err) {
      console.error('XMI import failed', err)
      alert('Failed to parse XMI file. See console for details.')
    } finally {
      importing = false
      ;(e.target as HTMLInputElement).value = ''
    }
  }

  function exportXmi() {
    const xml = emitXmi(store.model)
    const blob = new Blob([xml], { type: 'text/xml' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'model.xmi'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function relayout() {
    layouting = true
    try {
      const { positions, sizes } = await layoutModel(store.model, algorithm)
      store.positions = { ...store.positions, ...positions }
      store.sizes = { ...store.sizes, ...sizes }
    } catch (err) {
      console.error('Layout failed', err)
    } finally {
      layouting = false
    }
  }
</script>

<input
  bind:this={fileInput}
  type="file"
  accept=".xmi,.xml"
  style="display:none"
  onchange={importFile}
/>

<button class="tb-btn accent" onclick={() => store.addElement('uml:Class', undefined, selectedPackageId ?? undefined)}>
  <span class="material-symbols-rounded">add</span> Class
</button>

<button class="tb-btn accent-green" onclick={() => store.addElement('uml:DataType', undefined, selectedPackageId ?? undefined)}>
  <span class="material-symbols-rounded">add</span> DataType
</button>

<button class="tb-btn accent-pkg" onclick={() => store.addElement('uml:Package')}>
  <span class="material-symbols-rounded">folder</span> Package
</button>

<div class="tb-sep"></div>

<button class="tb-btn" onclick={() => fileInput.click()} disabled={importing}>
  <span class="material-symbols-rounded">upload_file</span>
  {importing ? 'Importing…' : 'Import'}
</button>

<button class="tb-btn" onclick={exportXmi} disabled={store.model.order.length === 0}>
  <span class="material-symbols-rounded">download</span> Export XMI
</button>

<select bind:value={algorithm} class="algo-select" title="Layout algorithm">
  {#each algorithms as a}
    <option value={a}>{a}</option>
  {/each}
</select>

<button
  class="tb-btn"
  onclick={relayout}
  disabled={store.model.order.length === 0 || layouting}
  title="Re-run automatic layout"
>
  <span class="material-symbols-rounded">account_tree</span>
  {layouting ? 'Laying out…' : 'Layout'}
</button>

<style>
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
  .algo-select {
    padding: 6px 8px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 13px;
  }
  .tb-btn.accent {
    border-color: #534AB7;
    color: #534AB7;
    font-weight: 600;
  }
  .tb-btn.accent:hover:not(:disabled) {
    background: #EEEDFE;
  }
  .tb-btn.accent-green {
    border-color: #0F6E56;
    color: #0F6E56;
    font-weight: 600;
  }
  .tb-btn.accent-green:hover:not(:disabled) {
    background: #E1F5EE;
  }
  .tb-btn.accent-pkg {
    border-color: #7B74D0;
    color: #7B74D0;
    font-weight: 600;
  }
  .tb-btn.accent-pkg:hover:not(:disabled) {
    background: #EEEDFE;
  }
  .tb-sep {
    width: 1px;
    background: #e0e0e0;
    align-self: stretch;
    margin: 0 4px;
  }
</style>
