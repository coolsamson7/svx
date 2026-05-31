<script lang="ts">
  interface Props {
    message: string
    confirmLabel?: string
    onConfirm: () => void
    onCancel: () => void
  }
  let { message, confirmLabel = 'Delete', onConfirm, onCancel }: Props = $props()

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onCancel()
    if (e.key === 'Enter') onConfirm()
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="backdrop" onclick={onCancel} role="dialog" aria-modal="true">
  <div class="dialog" onclick={(e) => e.stopPropagation()}>
    <div class="message">{message}</div>
    <div class="actions">
      <button class="btn cancel" onclick={onCancel}>Cancel</button>
      <button class="btn danger" onclick={onConfirm}>{confirmLabel}</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    animation: fade-in 0.1s ease;
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .dialog {
    background: white;
    border-radius: 10px;
    padding: 20px 24px;
    min-width: 280px;
    max-width: 400px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    animation: slide-up 0.12s ease;
  }
  @keyframes slide-up {
    from { transform: translateY(8px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .message {
    font-size: 14px;
    color: #24292f;
    margin-bottom: 20px;
    line-height: 1.5;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .btn {
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid;
  }
  .cancel {
    background: white;
    color: #24292f;
    border-color: #d0d7de;
  }
  .cancel:hover { background: #f6f8fa; }
  .danger {
    background: #cf222e;
    color: white;
    border-color: #cf222e;
  }
  .danger:hover { background: #a40e26; border-color: #a40e26; }
</style>
