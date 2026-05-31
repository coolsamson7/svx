<script lang="ts">
  import ConfirmDialog from '../ConfirmDialog.svelte'
  import { store } from '../../model/store.svelte'

  interface Props {
    id: string
    name: string
    kind: string
    selected: boolean
  }
  let { id, name, kind, selected }: Props = $props()
  let confirming = $state(false)

  const label = $derived(
    kind === 'uml:Package' ? `package "${name}" and all its contents` : `"${name}"`
  )
</script>

{#if selected}
  <button
    class="del-btn"
    onclick={(e) => { e.stopPropagation(); confirming = true }}
    title="Delete"
  >✕</button>
{/if}

{#if confirming}
  <ConfirmDialog
    message={`Delete ${label}?`}
    onConfirm={() => { store.deleteElement(id); confirming = false }}
    onCancel={() => confirming = false}
  />
{/if}

<style>
  .del-btn {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #cf222e;
    color: white;
    border: 2px solid white;
    font-size: 9px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
    line-height: 1;
    padding: 0;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  }
  .del-btn:hover {
    background: #a40e26;
    transform: scale(1.1);
  }
</style>
