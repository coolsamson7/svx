<script lang="ts">
  import { store } from '../../model/store.svelte'
</script>

<div class="undo-bar">
  <button
    class="tb-btn"
    onclick={() => store.undo()}
    disabled={!store.canUndo}
    title="Undo (Cmd+Z)"
  >
    <span class="material-symbols-rounded">undo</span>
  </button>
  <button
    class="tb-btn"
    onclick={() => store.redo()}
    disabled={!store.canRedo}
    title="Redo (Cmd+Shift+Z)"
  >
    <span class="material-symbols-rounded">redo</span>
  </button>
  <span class="change-count">{store.past.length - 1} change{store.past.length !== 2 ? 's' : ''}</span>
</div>

<style>
  .undo-bar {
    display: flex;
    gap: 4px;
    margin-left: auto;
    align-items: center;
  }
  .tb-btn {
    display: flex;
    align-items: center;
    padding: 6px;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: white;
    cursor: pointer;
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
  .change-count {
    font-size: 12px;
    color: #888;
    white-space: nowrap;
  }
</style>
