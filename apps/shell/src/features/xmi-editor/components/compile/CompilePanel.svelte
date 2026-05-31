<script lang="ts">
  import { emitXmi, compileXmi, type CompileOptions, type CompileResult } from '@svx/xmi'
  import { store } from '../../model/store.svelte'
  import CompileConfig from './CompileConfig.svelte'
  import CodeViewer from './CodeViewer.svelte'
  import TsOutput from './TsOutput.svelte'

  interface Props { onClose: () => void }
  let { onClose }: Props = $props()

  let options = $state<CompileOptions>({
    dialect: 'postgres',
    generators: ['yaml', 'json', 'sql', 'schema', 'typeorm'],
    inheritanceStrategy: 'table_per_class',
    naming: {
      tables:      { spec: '=plural =SNAKE' },
      columns:     { spec: '=SNAKE' },
      foreignKeys: { prefix: 'FK_', maxLength: 63 },
      joinTables:  { prefix: '', separator: '_' },
      tsFiles:     { spec: '=kebab', dataTypeGrouping: 'one', dataTypeFileName: 'data-types', schemaGrouping: 'per-type', schemaFileName: 'entity-schemas' },
    },
    outputDirs: { schemas: 'schemas', entities: 'entities' },
  })

  type Tab = 'sql' | 'yaml' | 'json' | 'ts'
  let activeTab = $state<Tab>('ts')
  let result = $state<CompileResult | null>(null)
  let error = $state<string | null>(null)
  let compiling = $state(false)
  let showConfig = $state(true)

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
  const tabs: { id: Tab; label: string }[] = [
    { id: 'ts',   label: 'TypeScript' },
    { id: 'sql',  label: 'SQL' },
    { id: 'yaml', label: 'YAML' },
    { id: 'json', label: 'JSON' },
  ]
</script>

<div class="panel">
  <div class="panel-header">
    <span class="title">Compile</span>
    <div class="header-actions">
      <button class="icon-btn" onclick={() => showConfig = !showConfig} title="Toggle config">⚙</button>
      <button class="icon-btn" onclick={onClose} title="Close">✕</button>
    </div>
  </div>

  <div class="panel-body">
    {#if showConfig}
      <div class="config-pane">
        <CompileConfig value={options} onChange={v => options = v} />
        <div class="compile-action">
          <button class="compile-btn" onclick={compile} disabled={compiling}>
            {compiling ? 'Compiling…' : '▶ Compile'}
          </button>
        </div>
      </div>
    {/if}

    <div class="results-pane">
      {#if !hasResult && !error}
        <div class="empty-state">
          <div class="empty-icon">⚡</div>
          <div class="empty-msg">Configure options and click Compile</div>
          {#if !showConfig}
            <button class="compile-btn" onclick={compile} disabled={compiling}>
              {compiling ? 'Compiling…' : '▶ Compile'}
            </button>
          {/if}
        </div>
      {:else if error}
        <div class="error-state">
          <div class="error-title">Compilation error</div>
          <pre class="error-msg">{error}</pre>
        </div>
      {:else if result}
        <div class="result-tabs">
          {#each tabs as tab}
            <button
              class:active={activeTab === tab.id}
              onclick={() => activeTab = tab.id}
            >{tab.label}</button>
          {/each}
          <div class="tab-spacer"></div>
          {#if !showConfig}
            <button class="compile-btn-sm" onclick={compile} disabled={compiling}>
              {compiling ? '…' : '▶ Re-compile'}
            </button>
          {/if}
        </div>

        <div class="result-content">
          {#if activeTab === 'ts'}
            <TsOutput schemas={result.schemas} entities={result.entities} />
          {:else if activeTab === 'sql' && result.sql}
            <CodeViewer code={result.sql} language="sql" />
          {:else if activeTab === 'yaml' && result.yaml}
            <CodeViewer code={result.yaml} language="yaml" />
          {:else if activeTab === 'json' && result.json}
            <CodeViewer code={result.json} language="json" />
          {:else}
            <div class="empty">Generator not enabled or produced no output</div>
          {/if}
        </div>
      {/if}
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
