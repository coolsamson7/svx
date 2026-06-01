<script lang="ts">
  import { emitXmi, compileXmi, type CompileOptions, type CompileResult } from '@svx/xmi'
  import { stringify as toYaml, parse as parseYaml } from 'yaml'
  import { untrack } from 'svelte'
  import { store } from '../../model/store.svelte'
  import CompileConfig from './CompileConfig.svelte'
  import CodeViewer from './CodeViewer.svelte'
  import TsOutput from './TsOutput.svelte'

  interface Props { onClose?: () => void }
  let { onClose }: Props = $props()

  let options = $state<CompileOptions>({
    dialect: 'postgres',
    generators: ['typeorm', 'schema', 'sql'],
    inheritanceStrategy: 'table_per_class',
    emitForeignKeys: true,
    naming: {
      tables:           { spec: '=plural =SNAKE' },
      columns:          { spec: '=SNAKE' },
      foreignKeys:      { pattern: 'OR_{table}_{target}' },
      foreignKeyColumns:{ spec: '=SNAKE OR_{name}_ID' },
      joinTables:       { prefix: '', separator: '_' },
      entities:         { spec: '' },
      tsFiles:          { spec: '=kebab', dataTypeGrouping: 'one', dataTypeFileName: 'data-types', schemaGrouping: 'per-type', schemaFileName: 'entity-schemas', entityFileSuffix: 'entity', entitySubDir: '', schemaFileSuffix: 'schema', schemaSubDir: '' },
    },
    outputDirs: { schemas: 'schemas', entities: 'entities' },
  })

  type Tab = 'typeorm' | 'schema' | 'sql'
  const ALL_TABS: { id: Tab; label: string; gen: string }[] = [
    { id: 'typeorm', label: 'TypeORM', gen: 'typeorm' },
    { id: 'schema',  label: 'Schema',  gen: 'schema'  },
    { id: 'sql',     label: 'SQL',     gen: 'sql'     },
  ]

  let activeTab = $state<Tab>('typeorm')
  let result = $state<CompileResult | null>(null)
  let error = $state<string | null>(null)
  let compiling = $state(false)
  let showConfig = $state(true)
  let configTab = $state<'form' | 'yaml'>('form')
  let yamlParseError = $state<string | null>(null)
  let yamlDraft = $state<string | null>(null)

  const configYamlLive = $derived(toYaml($state.snapshot(options), { indent: 2 }))

  const visibleTabs = $derived(
    ALL_TABS.filter(t => options.generators?.includes(t.gen as never) ?? true)
  )

  // If the active tab's generator gets unchecked, switch to the first visible tab
  $effect(() => {
    const tabs = visibleTabs
    if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
      activeTab = tabs[0].id
    }
  })

  function onYamlInput(text: string) {
    yamlDraft = text
    try {
      const parsed = parseYaml(text) as CompileOptions
      if (parsed && typeof parsed === 'object') {
        options = parsed
        yamlParseError = null
      }
    } catch (e) {
      yamlParseError = e instanceof Error ? e.message : String(e)
    }
  }

  $effect(() => {
    const tab = configTab
    if (tab === 'yaml') {
      yamlDraft = untrack(() => configYamlLive)
      yamlParseError = null
    }
  })

  async function compile() {
    error = null
    compiling = true
    try {
      const xmi = emitXmi(store.model)
      result = compileXmi(xmi, options)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
      result = null
    } finally {
      compiling = false
    }
  }

  const hasResult = $derived(result !== null)
</script>

<div class="panel">
  <div class="panel-header">
    <span class="title">Compile</span>
    <div class="header-actions">
      <button class="compile-btn-sm" onclick={compile} disabled={compiling}>
        {compiling ? '…' : '▶ Run'}
      </button>
      <button class="icon-btn" onclick={() => showConfig = !showConfig} title="Toggle config">⚙</button>
      {#if onClose}
        <button class="icon-btn" onclick={onClose} title="Close">✕</button>
      {/if}
    </div>
  </div>

  <div class="panel-body">
    {#if showConfig}
      <div class="config-pane">
        <div class="config-tabs">
          <button class="config-tab" class:active={configTab === 'form'} onclick={() => configTab = 'form'}>Form</button>
          <button class="config-tab" class:active={configTab === 'yaml'} onclick={() => configTab = 'yaml'}>YAML</button>
        </div>
        {#if configTab === 'form'}
          <CompileConfig value={options} onChange={v => options = v} />
        {:else}
          <div class="yaml-editor-wrap">
            {#if yamlParseError}
              <div class="yaml-error">{yamlParseError}</div>
            {/if}
            <textarea
              class="yaml-editor"
              value={yamlDraft ?? configYamlLive}
              oninput={e => onYamlInput((e.target as HTMLTextAreaElement).value)}
              spellcheck={false}
            ></textarea>
          </div>
        {/if}
      </div>
    {/if}

    <div class="results-pane">
      <div class="result-tabs">
        {#each visibleTabs as tab}
          <button
            class:active={activeTab === tab.id}
            onclick={() => activeTab = tab.id}
          >{tab.label}</button>
        {/each}
        <div class="tab-spacer"></div>
      </div>

      <div class="result-content">
        {#if error}
          <div class="error-state">
            <div class="error-title">Compilation error</div>
            <pre class="error-msg">{error}</pre>
          </div>
        {:else if !hasResult}
          <div class="empty-state">
            <div class="empty-icon">⚡</div>
            <div class="empty-msg">Click ▶ Run to compile</div>
          </div>
        {:else if activeTab === 'typeorm'}
          <TsOutput schemas={undefined} entities={result!.entities} />
        {:else if activeTab === 'schema'}
          <TsOutput schemas={result!.schemas} entities={undefined} />
        {:else if activeTab === 'sql'}
          <CodeViewer code={result!.sql ?? ''} language="sql" />
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: white;
    border-left: 1px solid #e0e0e0;
    min-width: 0;
  }
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid #e0e0e0;
    background: #f6f8fa;
    flex-shrink: 0;
  }
  .title { font-weight: 600; font-size: 13px; }
  .header-actions { display: flex; gap: 4px; }
  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 14px;
    color: #57606a;
  }
  .icon-btn:hover { background: #e8ecf0; }

  .panel-body {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
  .config-pane {
    width: 260px;
    flex-shrink: 0;
    border-right: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .config-tabs {
    display: flex;
    border-bottom: 1px solid #e0e0e0;
    background: #f6f8fa;
    flex-shrink: 0;
  }
  .config-tab {
    flex: 1;
    padding: 6px 0;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    color: #57606a;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .config-tab.active {
    color: #534AB7;
    border-bottom-color: #534AB7;
    background: white;
    font-weight: 600;
  }
  .yaml-editor-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }
  .yaml-editor {
    flex: 1;
    width: 100%;
    resize: none;
    border: none;
    outline: none;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 11px;
    line-height: 1.5;
    padding: 10px 12px;
    background: #fafafa;
    color: #24292f;
    box-sizing: border-box;
  }
  .yaml-error {
    padding: 4px 8px;
    background: #fff0f0;
    color: #cf222e;
    font-size: 10px;
    border-bottom: 1px solid #ffc0c0;
    flex-shrink: 0;
  }
  .compile-action {
    padding: 10px 12px;
    border-top: 1px solid #e0e0e0;
    background: #f6f8fa;
    flex-shrink: 0;
  }
  .results-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #57606a;
  }
  .empty-icon { font-size: 32px; opacity: 0.3; }
  .empty-msg { font-size: 13px; }
  .error-state { padding: 16px; }
  .error-title { font-weight: 600; color: #cf222e; margin-bottom: 8px; }
  .error-msg { font-family: monospace; font-size: 12px; white-space: pre-wrap; color: #cf222e; background: #fff0f0; padding: 8px; border-radius: 4px; }
  .result-tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 8px 0;
    border-bottom: 1px solid #e0e0e0;
    background: white;
    flex-shrink: 0;
  }
  .result-tabs button {
    padding: 4px 10px;
    border: 1px solid #d0d7de;
    border-bottom: none;
    border-radius: 4px 4px 0 0;
    background: #f6f8fa;
    cursor: pointer;
    font-size: 12px;
    color: #57606a;
    translate: 0 1px;
  }
  .result-tabs button.active {
    background: white;
    color: #24292f;
    font-weight: 600;
    border-bottom-color: white;
  }
  .tab-spacer { flex: 1; }
  .result-content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
  .empty { flex: 1; display: flex; align-items: center; justify-content: center; color: #57606a; font-size: 13px; }
  .compile-btn {
    width: 100%;
    padding: 6px 12px;
    background: #1f883d;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
  }
  .compile-btn:hover { background: #1a7f37; }
  .compile-btn:disabled { background: #94d3a2; cursor: not-allowed; }
  .compile-btn-sm {
    padding: 3px 10px;
    background: #1f883d;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 1px;
  }
</style>
