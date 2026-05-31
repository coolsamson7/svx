<script lang="ts">
  import type { CompileOptions } from '@svx/xmi'

  interface Props {
    value: CompileOptions
    onChange: (v: CompileOptions) => void
  }

  let { value, onChange }: Props = $props()

  function set<K extends keyof CompileOptions>(key: K, v: CompileOptions[K]) {
    onChange({ ...$state.snapshot(value), [key]: v })
  }

  const INHERITANCE_STRATEGIES = [
    { value: 'table_per_class', label: 'Table Per Class', desc: 'Each concrete class gets its own full table (inherited columns flattened in)' },
    { value: 'single_table',    label: 'Single Table',    desc: 'One shared table per hierarchy with a DTYPE discriminator column' },
    { value: 'joined',          label: 'Joined',          desc: 'One table per class; subclass tables have FK to the abstract parent table' },
  ]

  function setNaming(path: string[], v: unknown) {
    const naming = $state.snapshot(value.naming) ?? defaultNaming()
    let cur: Record<string, unknown> = naming as unknown as Record<string, unknown>
    for (let i = 0; i < path.length - 1; i++) {
      if (!cur[path[i]]) cur[path[i]] = {}
      cur = cur[path[i]] as Record<string, unknown>
    }
    cur[path[path.length - 1]] = v
    onChange({ ...$state.snapshot(value), naming })
  }

  function defaultNaming() {
    return {
      tables:            { spec: '=plural =SNAKE' },
      columns:           { spec: '=SNAKE' },
      foreignKeys:       { pattern: 'OR_{table}_{target}' },
      foreignKeyColumns: { spec: '=SNAKE OR_{name}_ID' },
      joinTables:        { prefix: '', separator: '_' },
      entities:          { spec: '' },
      tsFiles:           { spec: '=kebab', dataTypeGrouping: 'one', dataTypeFileName: 'data-types', schemaGrouping: 'per-type', schemaFileName: 'entity-schemas' },
    }
  }

  const n  = $derived(value.naming ?? defaultNaming())
  const tf = $derived(n.tsFiles ?? {})
  const generators = $derived(value.generators ?? ['yaml', 'json', 'sql', 'schema', 'typeorm'])

  function toggleGen(name: string) {
    const cur = $state.snapshot(value.generators) ?? ['yaml', 'json', 'sql', 'schema', 'typeorm']
    const next = cur.includes(name as never) ? cur.filter(g => g !== name) : [...cur, name as never]
    set('generators', next as CompileOptions['generators'])
  }

  const SPEC_HINT = `Name transformation DSL (space-separated, left-to-right):
  -Suffix     strip trailing suffix
  +Suffix     append suffix
  ^Prefix     prepend prefix
  ^-Prefix    strip leading prefix
  ~foo->bar   replace first occurrence
  =snake      lower_snake_case
  =SNAKE      UPPER_SNAKE_CASE
  =kebab      kebab-case
  =camel      camelCase
  =pascal     PascalCase
  =plural     pluralize

  {name}      template: replaced by current running value
              e.g. =SNAKE OR_{name}_ID
                   contactInfo → OR_CONTACT_INFO_ID`

  const FK_CONSTRAINT_HINT = `Constraint name pattern. Placeholders:
  {table}   owning table name (after table transform)
  {target}  referenced table name
  {column}  FK column name

Max length: from dialect (Postgres=63, MySQL=64, Oracle=128)
Example: OR_{table}_{target} → OR_USER_CONTACT_INFO`
</script>

<div class="config">
  <section>
    <h4>Dialect</h4>
    <select value={value.dialect ?? 'postgres'} onchange={e => set('dialect', (e.target as HTMLSelectElement).value as 'postgres' | 'oracle' | 'mysql')}>
      <option value="postgres">PostgreSQL</option>
      <option value="mysql">MySQL</option>
      <option value="oracle">Oracle</option>
    </select>
  </section>

  <section>
    <h4>Inheritance Strategy</h4>
    <div class="strategy-group">
      {#each INHERITANCE_STRATEGIES as s}
        <label class="strategy-option" title={s.desc}>
          <input type="radio"
            name="inheritanceStrategy"
            value={s.value}
            checked={(value.inheritanceStrategy ?? 'table_per_class') === s.value}
            onchange={() => set('inheritanceStrategy', s.value as CompileOptions['inheritanceStrategy'])}
          />
          {s.label}
        </label>
      {/each}
    </div>
  </section>

  <section>
    <h4>Generators</h4>
    <div class="checkgroup">
      {#each ['yaml', 'json', 'sql', 'schema', 'typeorm'] as g}
        <label><input type="checkbox" checked={generators.includes(g as never)} onchange={() => toggleGen(g)} /> {g}</label>
      {/each}
    </div>
  </section>

  <section>
    <h4>SQL Options</h4>
    <div class="checkgroup">
      <label>
        <input type="checkbox"
          checked={value.emitForeignKeys !== false}
          onchange={e => set('emitForeignKeys', (e.target as HTMLInputElement).checked)}
        /> Emit foreign keys
      </label>
    </div>
  </section>

  <section>
    <h4>Tables <span class="hint" title={SPEC_HINT}>?</span></h4>
    <label>Name spec
      <input type="text"
        value={(n.tables as any)?.spec ?? ''}
        oninput={e => setNaming(['tables', 'spec'], (e.target as HTMLInputElement).value)}
        placeholder="e.g. -Entity =snake =plural"
      />
    </label>
  </section>

  <section>
    <h4>Columns <span class="hint" title={SPEC_HINT}>?</span></h4>
    <label>Name spec
      <input type="text"
        value={(n.columns as any)?.spec ?? ''}
        oninput={e => setNaming(['columns', 'spec'], (e.target as HTMLInputElement).value)}
        placeholder="e.g. =snake"
      />
    </label>
  </section>

  <section>
    <h4>FK Constraints <span class="hint" title={FK_CONSTRAINT_HINT}>?</span></h4>
    <label>Constraint pattern
      <input type="text"
        value={(n.foreignKeys as any)?.pattern ?? 'OR_{table}_{target}'}
        oninput={e => setNaming(['foreignKeys', 'pattern'], (e.target as HTMLInputElement).value)}
        placeholder={'OR_{table}_{target}'}
      />
    </label>
  </section>

  <section>
    <h4>FK Columns <span class="hint" title={SPEC_HINT}>?</span></h4>
    <label>Name spec
      <input type="text"
        value={(n.foreignKeyColumns as any)?.spec ?? '=SNAKE +_ID'}
        oninput={e => setNaming(['foreignKeyColumns', 'spec'], (e.target as HTMLInputElement).value)}
        placeholder="=SNAKE +_ID"
      />
    </label>
  </section>

  <section>
    <h4>Join Tables</h4>
    <div class="row">
      <label>Prefix
        <input type="text" value={n.joinTables?.prefix ?? ''} oninput={e => setNaming(['joinTables', 'prefix'], (e.target as HTMLInputElement).value)} />
      </label>
      <label>Separator
        <input type="text" value={n.joinTables?.separator ?? '_'} oninput={e => setNaming(['joinTables', 'separator'], (e.target as HTMLInputElement).value)} />
      </label>
    </div>
  </section>

  <section>
    <h4>Entity Class Names <span class="hint" title={SPEC_HINT}>?</span></h4>
    <label>Name spec
      <input type="text"
        value={(n.entities as any)?.spec ?? ''}
        oninput={e => setNaming(['entities', 'spec'], (e.target as HTMLInputElement).value)}
        placeholder="e.g. +Entity"
      />
    </label>
  </section>

  <section>
    <h4>TypeScript Files <span class="hint" title={SPEC_HINT}>?</span></h4>
    <label>File stem spec
      <input type="text"
        value={(tf as any)?.spec ?? ''}
        oninput={e => setNaming(['tsFiles', 'spec'], (e.target as HTMLInputElement).value)}
        placeholder="e.g. -Entity =kebab"
      />
    </label>
    <div class="row">
      <label>DataType grouping
        <select value={tf.dataTypeGrouping ?? 'one'} onchange={e => setNaming(['tsFiles', 'dataTypeGrouping'], (e.target as HTMLSelectElement).value)}>
          <option value="one">one file</option>
          <option value="per-type">per type</option>
        </select>
      </label>
      <label>File name
        <input type="text" value={tf.dataTypeFileName ?? 'data-types'} oninput={e => setNaming(['tsFiles', 'dataTypeFileName'], (e.target as HTMLInputElement).value)} />
      </label>
    </div>
    <div class="row">
      <label>Schema grouping
        <select value={tf.schemaGrouping ?? 'per-type'} onchange={e => setNaming(['tsFiles', 'schemaGrouping'], (e.target as HTMLSelectElement).value)}>
          <option value="per-type">per type</option>
          <option value="one">one file</option>
        </select>
      </label>
      <label>File name
        <input type="text" value={tf.schemaFileName ?? 'entity-schemas'} oninput={e => setNaming(['tsFiles', 'schemaFileName'], (e.target as HTMLInputElement).value)} />
      </label>
    </div>
  </section>

  <section>
    <h4>Output Dirs</h4>
    <div class="row">
      <label>Schemas
        <input type="text" value={value.outputDirs?.schemas ?? 'schemas'} oninput={e => onChange({ ...value, outputDirs: { ...value.outputDirs, schemas: (e.target as HTMLInputElement).value } })} />
      </label>
      <label>Entities
        <input type="text" value={value.outputDirs?.entities ?? 'entities'} oninput={e => onChange({ ...value, outputDirs: { ...value.outputDirs, entities: (e.target as HTMLInputElement).value } })} />
      </label>
    </div>
  </section>
</div>

<style>
  .config {
    font-size: 12px;
    display: flex;
    flex-direction: column;
    gap: 0;
    overflow-y: auto;
    height: 100%;
  }
  section {
    padding: 10px 12px;
    border-bottom: 1px solid #f0f0f0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  h4 {
    margin: 0 0 2px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #57606a;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .hint {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #d0d7de;
    color: #57606a;
    font-size: 9px;
    font-weight: 700;
    cursor: help;
    text-transform: none;
    letter-spacing: 0;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: #24292f;
  }
  .row { display: flex; gap: 8px; }
  .row label { flex: 1; }
  .checkgroup { display: flex; flex-wrap: wrap; gap: 8px; }
  .checkgroup label { flex-direction: row; align-items: center; gap: 4px; }
  .strategy-group { display: flex; flex-direction: column; gap: 4px; }
  .strategy-option { flex-direction: row; align-items: center; gap: 6px; cursor: pointer; }
  .strategy-option input[type="radio"] { width: auto; }
  input[type="text"], input[type="number"], select {
    padding: 3px 6px;
    border: 1px solid #d0d7de;
    border-radius: 4px;
    font-size: 12px;
    font-family: monospace;
    background: white;
    width: 100%;
  }
  input[type="text"]::placeholder { font-family: monospace; color: #bbb; }
  input[type="checkbox"] { width: auto; }
</style>
