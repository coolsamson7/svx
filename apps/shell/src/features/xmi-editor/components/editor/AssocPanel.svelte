<script lang="ts">
  import type { UmlAssociation, AssocEnd } from '../../model/types'
  import AssocEndEditor from './AssocEndEditor.svelte'

  interface Props { assoc: UmlAssociation }
  let { assoc }: Props = $props()

  /** The FK-owning end is the one with upper='1' when the other is many */
  function isFkEnd(end: AssocEnd, other: AssocEnd): boolean {
    const otherIsMany = other.upper === '*' || other.upper === '-1' || Number(other.upper) > 1
    return end.upper === '1' && otherIsMany
  }
</script>

<div class="assoc-panel">
  {#each assoc.ends as end, i}
    {@const other = assoc.ends[i === 0 ? 1 : 0]}
    {@const idx = i as 0 | 1}
    <div class="end-section">
      <AssocEndEditor
        assocId={assoc.id}
        endIdx={idx}
        {end}
        isFk={isFkEnd(end, other)}
      />
    </div>
    {#if i === 0}
      <div class="divider"></div>
    {/if}
  {/each}
</div>

<style>
  .assoc-panel {
    display: flex;
    flex-direction: column;
  }

  .end-section {
    padding: 14px;
  }

  .divider {
    height: 1px;
    background: #e8e8e8;
    margin: 0 12px;
  }
</style>
