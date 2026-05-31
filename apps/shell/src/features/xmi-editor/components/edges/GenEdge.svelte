<script lang="ts">
  import { getBezierPath, BaseEdge } from '@xyflow/svelte'
  import type { EdgeProps } from '@xyflow/svelte'

  let { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected }: EdgeProps = $props()

  const pathResult = $derived(getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }))
  const edgePath = $derived(pathResult[0])
  const markerId = $derived(`gen-arrow-${id}`)
  const color = $derived(selected ? '#534AB7' : '#888')
</script>

<defs>
  <marker id={markerId} markerWidth="14" markerHeight="10" refX="13" refY="5" orient="auto">
    <path d="M 0 0 L 12 5 L 0 10 z" fill="white" stroke={color} stroke-width="1.5"/>
  </marker>
</defs>

<BaseEdge
  path={edgePath}
  style={`stroke:${color};stroke-width:${selected ? 2 : 1.5};stroke-dasharray:5,3`}
  markerEnd={`url(#${markerId})`}
/>
