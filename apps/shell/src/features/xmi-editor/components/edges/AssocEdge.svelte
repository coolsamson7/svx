<script lang="ts">
  import { getStraightPath, BaseEdge } from '@xyflow/svelte'
  import type { EdgeProps } from '@xyflow/svelte'
  import type { UmlAssociation } from '../../model/types'

  let { id, sourceX, sourceY, targetX, targetY, data, selected }: EdgeProps<{ assoc: UmlAssociation }> = $props()

  const pathResult = $derived(getStraightPath({ sourceX, sourceY, targetX, targetY }))
  const edgePath = $derived(pathResult[0])

  const srcEnd = $derived(data?.assoc?.ends[0])
  const tgtEnd = $derived(data?.assoc?.ends[1])

  const srcLabel = $derived(
    srcEnd ? `${srcEnd.role ? srcEnd.role + ' ' : ''}[${srcEnd.lower}..${srcEnd.upper}]` : ''
  )
  const tgtLabel = $derived(
    tgtEnd ? `${tgtEnd.role ? tgtEnd.role + ' ' : ''}[${tgtEnd.lower}..${tgtEnd.upper}]` : ''
  )

  // Push labels 15% along the line away from each endpoint
  const dx = $derived(targetX - sourceX)
  const dy = $derived(targetY - sourceY)
  const srcLx = $derived(sourceX + dx * 0.15)
  const srcLy = $derived(sourceY + dy * 0.15)
  const tgtLx = $derived(targetX - dx * 0.15)
  const tgtLy = $derived(targetY - dy * 0.15)
</script>

<BaseEdge
  path={edgePath}
  style={`stroke:${selected ? '#534AB7' : '#888'};stroke-width:${selected ? 2 : 1.5}`}
/>

{#if srcLabel}
  <text
    x={srcLx}
    y={srcLy}
    text-anchor="middle"
    dominant-baseline="auto"
    font-size="11"
    font-family="system-ui, sans-serif"
    fill="#555"
    class="edge-label"
  >{srcLabel}</text>
{/if}

{#if tgtLabel}
  <text
    x={tgtLx}
    y={tgtLy}
    text-anchor="middle"
    dominant-baseline="hanging"
    font-size="11"
    font-family="system-ui, sans-serif"
    fill="#555"
    class="edge-label"
  >{tgtLabel}</text>
{/if}

<style>
  .edge-label {
    pointer-events: none;
    user-select: none;
  }
</style>
