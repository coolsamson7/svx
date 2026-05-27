<script lang="ts">
  import { store } from '../../model/store.svelte'

  let {
    elementId,
    tags,
    knownKeys,
  }: { elementId: string; tags: Record<string, string>; knownKeys: string[] } = $props()

  let newKey = $state('')
  let newValue = $state('')

  const extraTags = $derived(Object.entries(tags).filter(([k]) => !knownKeys.includes(k)))

  function updateTag(key: string, value: string) {
    store.updateElement(elementId, { tags: { ...tags, [key]: value } })
  }

  function deleteTag(key: string) {
    const { [key]: _, ...rest } = tags
    store.updateElement(elementId, { tags: rest })
  }

  function addTag() {
    if (!newKey.trim()) return
    store.updateElement(elementId, { tags: { ...tags, [newKey.trim()]: newValue } })
    newKey = ''
    newValue = ''
  }
</script>

<div class="tv-editor">
  {#each extraTags as [key, value]}
    <div class="tv-row">
      <span class="tv-key">{key}</span>
      <input
        class="tv-val"
        type="text"
        value={value}
        oninput={e => updateTag(key, (e.target as HTMLInputElement).value)}
      />
      <button class="icon-btn" onclick={() => deleteTag(key)} title="Remove tag">
        <span class="material-symbols-rounded" style="font-size:16px">close</span>
      </button>
    </div>
  {/each}
  <div class="tv-add-row">
    <input class="tv-key-input" type="text" placeholder="tag" bind:value={newKey} />
    <input class="tv-val-input" type="text" placeholder="value" bind:value={newValue} />
    <button class="add-btn" onclick={addTag} title="Add tag">
      <span class="material-symbols-rounded">add</span>
    </button>
  </div>
</div>

<style>
  .tv-editor {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .tv-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tv-key {
    font-size: 12px;
    color: #666;
    min-width: 80px;
  }
  .tv-val {
    flex: 1;
    padding: 4px 6px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 12px;
  }
  .icon-btn {
    border: none;
    background: none;
    cursor: pointer;
    color: #aaa;
    display: flex;
    align-items: center;
  }
  .icon-btn:hover {
    color: #c00;
  }
  .tv-add-row {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }
  .tv-key-input {
    width: 80px;
    padding: 4px 6px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 12px;
  }
  .tv-val-input {
    flex: 1;
    padding: 4px 6px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 12px;
  }
  .add-btn {
    border: none;
    background: #534AB7;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
  }
  .add-btn:hover {
    background: #3C3489;
  }
</style>
