<script lang="ts">
  interface Props {
    lower: string
    upper: string
    onchange: (lower: string, upper: string) => void
  }
  let { lower, upper, onchange }: Props = $props()

  const PRESETS = [
    { label: '1',    lower: '1', upper: '1' },
    { label: '0..1', lower: '0', upper: '1' },
    { label: '0..*', lower: '0', upper: '*' },
    { label: '1..*', lower: '1', upper: '*' },
  ]

  const activePreset = $derived(
    PRESETS.find(p => p.lower === lower && p.upper === upper) ?? null
  )
  let showCustom = $state(!activePreset)

  $effect(() => {
    // If value changes from outside and matches a preset, hide custom
    if (PRESETS.some(p => p.lower === lower && p.upper === upper)) {
      showCustom = false
    }
  })

  function pickPreset(p: typeof PRESETS[0]) {
    showCustom = false
    onchange(p.lower, p.upper)
  }
</script>

<div class="mult-picker">
  <div class="pills">
    {#each PRESETS as p}
      <button
        class="pill"
        class:active={activePreset?.label === p.label}
        onclick={() => pickPreset(p)}
        type="button"
      >{p.label}</button>
    {/each}
    <button
      class="pill pill-custom"
      class:active={showCustom}
      onclick={() => showCustom = !showCustom}
      type="button"
      title="Custom bounds"
    >…</button>
  </div>

  {#if showCustom}
    <div class="custom-row">
      <input
        type="text"
        value={lower}
        class="bound-input"
        placeholder="0"
        title="Lower bound"
        oninput={(e) => onchange((e.target as HTMLInputElement).value, upper)}
      />
      <span class="sep">..</span>
      <input
        type="text"
        value={upper}
        class="bound-input"
        placeholder="*"
        title="Upper bound"
        oninput={(e) => onchange(lower, (e.target as HTMLInputElement).value)}
      />
    </div>
  {/if}
</div>

<style>
  .mult-picker {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .pills {
    display: flex;
    gap: 3px;
  }

  .pill {
    padding: 3px 7px;
    font-size: 11px;
    font-family: monospace;
    border: 1px solid #d0d0d0;
    border-radius: 4px;
    background: #fafafa;
    cursor: pointer;
    color: #444;
    white-space: nowrap;
    transition: all 0.1s;
  }

  .pill:hover {
    border-color: #534AB7;
    color: #534AB7;
  }

  .pill.active {
    background: #534AB7;
    border-color: #534AB7;
    color: white;
    font-weight: 600;
  }

  .pill-custom {
    color: #888;
    min-width: 26px;
  }

  .custom-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-left: 2px;
  }

  .bound-input {
    width: 38px;
    padding: 3px 5px;
    font-size: 12px;
    font-family: monospace;
    border: 1px solid #ddd;
    border-radius: 4px;
    text-align: center;
  }

  .bound-input:focus {
    outline: none;
    border-color: #534AB7;
  }

  .sep {
    font-size: 12px;
    color: #888;
    font-family: monospace;
  }
</style>
