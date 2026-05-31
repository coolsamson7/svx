<script lang="ts">
  import { onMount, tick } from 'svelte'
  import hljs from 'highlight.js/lib/core'
  import ts from 'highlight.js/lib/languages/typescript'
  import sql from 'highlight.js/lib/languages/sql'
  import yaml from 'highlight.js/lib/languages/yaml'
  import json from 'highlight.js/lib/languages/json'
  import 'highlight.js/styles/github.css'

  hljs.registerLanguage('typescript', ts)
  hljs.registerLanguage('sql', sql)
  hljs.registerLanguage('yaml', yaml)
  hljs.registerLanguage('json', json)

  interface Props {
    code: string
    language?: 'typescript' | 'sql' | 'yaml' | 'json'
  }

  let { code, language = 'typescript' }: Props = $props()

  let codeEl: HTMLElement

  $effect(() => {
    if (codeEl && code) {
      codeEl.removeAttribute('data-highlighted')
      codeEl.textContent = code
      hljs.highlightElement(codeEl)
    }
  })
</script>

<div class="code-viewer">
  <pre><code bind:this={codeEl} class="language-{language}"></code></pre>
</div>

<style>
  .code-viewer {
    height: 100%;
    overflow: auto;
    background: #f6f8fa;
    border-radius: 4px;
  }
  pre {
    margin: 0;
    padding: 12px 16px;
    font-size: 12px;
    line-height: 1.5;
  }
  code {
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
    background: none;
  }
</style>
