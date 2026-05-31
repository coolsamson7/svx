<script lang="ts">
  import hljs from 'highlight.js/lib/core'
  import xml from 'highlight.js/lib/languages/xml'
  import 'highlight.js/styles/github.css'
  import { store } from '../model/store.svelte'

  hljs.registerLanguage('xml', xml)

  interface Props { xmi: string }
  let { xmi }: Props = $props()

  let codeEl = $state<HTMLElement | undefined>(undefined)
  let containerEl = $state<HTMLElement | undefined>(undefined)
  let highlightedLine = $state<number>(-1)
  let lineHeight = $state(18)

  $effect(() => {
    if (!codeEl) return
    codeEl.removeAttribute('data-highlighted')
    codeEl.textContent = xmi
    hljs.highlightElement(codeEl)
    // Measure actual line height after render
    lineHeight = parseFloat(getComputedStyle(codeEl).lineHeight) || 18
  })

  $effect(() => {
    const id = store.selectedId
    if (!id || !containerEl) { highlightedLine = -1; return }

    const lines = xmi.split('\n')
    const pattern = `xmi:id="${id}"`
    const lineIdx = lines.findIndex(l => l.includes(pattern))
    if (lineIdx < 0) { highlightedLine = -1; return }

    highlightedLine = lineIdx
    // Scroll so the line is near the top with some context
    containerEl.scrollTo({ top: lineIdx * lineHeight - 60, behavior: 'smooth' })
  })
</script>

<div class="xmi-view" bind:this={containerEl}>
  <div class="xmi-header">XMI Source</div>
  <div class="code-wrap">
    {#if highlightedLine >= 0}
      <div
        class="line-highlight"
        style="top: {highlightedLine * lineHeight + 12}px; height: {lineHeight}px"
      ></div>
    {/if}
    <pre><code bind:this={codeEl} class="language-xml"></code></pre>
  </div>
</div>

<style>
  .xmi-view {
    height: 100%;
    overflow: auto;
    display: flex;
    flex-direction: column;
    background: #f6f8fa;
  }
  .xmi-header {
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #57606a;
    border-bottom: 1px solid #e0e0e0;
    background: white;
    flex-shrink: 0;
    position: sticky;
    top: 0;
    z-index: 1;
  }
  .code-wrap {
    position: relative;
    flex: 1;
  }
  .line-highlight {
    position: absolute;
    left: 0;
    right: 0;
    background: rgba(83, 74, 183, 0.1);
    border-left: 3px solid #534AB7;
    pointer-events: none;
    z-index: 0;
  }
  pre {
    margin: 0;
    padding: 12px 16px;
    position: relative;
    z-index: 1;
  }
  code {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    background: none;
    white-space: pre;
    line-height: 1.5;
    font-size: 12px;
  }
</style>
