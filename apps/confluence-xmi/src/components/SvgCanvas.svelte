<script lang="ts">
  import { store } from '../model/store.svelte'
  import type { UmlAssociation } from '../model/types'

  const NODE_W = 180
  const HEADER_H = 38
  const ATTR_H = 20
  const ATTR_PAD = 6

  function nodeH(id: string) {
    const el = store.model.elements[id]
    if (!el || el.attrs.length === 0) return HEADER_H
    return HEADER_H + ATTR_PAD + el.attrs.length * ATTR_H + ATTR_PAD
  }

  const nodeIds = $derived(
    store.model.order.filter(id => store.model.elements[id]?.kind !== 'uml:Association')
  )
  const assocIds = $derived(
    store.model.order.filter(id => store.model.elements[id]?.kind === 'uml:Association')
  )

  let tx = $state(0), ty = $state(0), scale = $state(1)
  let panning = $state(false)
  let panStart = { mx: 0, my: 0, tx: 0, ty: 0 }
  let draggingNodeId = $state<string | null>(null)
  let nodeDragStart = { mx: 0, my: 0, nx: 0, ny: 0 }

  function onWheel(e: WheelEvent) {
    e.preventDefault()
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const s2 = Math.max(0.1, Math.min(4, scale * factor))
    tx = mx - (mx - tx) * (s2 / scale)
    ty = my - (my - ty) * (s2 / scale)
    scale = s2
  }

  function onSvgMousedown(e: MouseEvent) {
    if (e.button !== 0) return
    panning = true
    panStart = { mx: e.clientX, my: e.clientY, tx, ty }
  }

  function onMousemove(e: MouseEvent) {
    if (panning) {
      tx = panStart.tx + (e.clientX - panStart.mx)
      ty = panStart.ty + (e.clientY - panStart.my)
    }
    if (draggingNodeId) {
      const dx = (e.clientX - nodeDragStart.mx) / scale
      const dy = (e.clientY - nodeDragStart.my) / scale
      store.moveNode(draggingNodeId, nodeDragStart.nx + dx, nodeDragStart.ny + dy)
    }
  }

  function onMouseup() {
    panning = false
    draggingNodeId = null
  }

  function onNodeMousedown(e: MouseEvent, id: string) {
    e.stopPropagation()
    store.selectedId = id
    draggingNodeId = id
    nodeDragStart = {
      mx: e.clientX, my: e.clientY,
      nx: store.positions[id]?.x ?? 0,
      ny: store.positions[id]?.y ?? 0,
    }
  }

  function onPaneClick() {
    store.selectedId = null
  }

  function edgePts(assocId: string) {
    const assoc = store.model.elements[assocId] as UmlAssociation
    const srcId = assoc.ends[0].typeId
    const tgtId = assoc.ends[1].typeId
    const src = store.positions[srcId]
    const tgt = store.positions[tgtId]
    if (!src || !tgt) return null
    return {
      x1: src.x + NODE_W / 2, y1: src.y + nodeH(srcId) / 2,
      x2: tgt.x + NODE_W / 2, y2: tgt.y + nodeH(tgtId) / 2,
    }
  }

  function nodeColor(kind: string) {
    if (kind === 'uml:DataType') return { fill: '#e1f5ee', stroke: '#0f6e56', text: '#0a4d3c' }
    if (kind === 'uml:PrimitiveType') return { fill: '#f1efe8', stroke: '#5f5e5a', text: '#3a3935' }
    return { fill: '#eeedfe', stroke: '#534ab7', text: '#3c3489' }
  }
</script>

<svg
  class="svg-canvas"
  class:panning
  onwheel={onWheel}
  onmousedown={onSvgMousedown}
  onmousemove={onMousemove}
  onmouseup={onMouseup}
  onmouseleave={onMouseup}
  onclick={onPaneClick}
>
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#b1b1b7" />
    </marker>
    <marker id="arrow-sel" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="#534ab7" />
    </marker>
  </defs>

  <g transform="translate({tx} {ty}) scale({scale})">
    <!-- Edges -->
    {#each assocIds as id}
      {@const pts = edgePts(id)}
      {#if pts}
        {@const sel = store.selectedId === id}
        <line
          class="edge"
          class:edge-sel={sel}
          x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2}
          marker-end={sel ? 'url(#arrow-sel)' : 'url(#arrow)'}
          onclick={(e) => { e.stopPropagation(); store.selectedId = id }}
        />
      {/if}
    {/each}

    <!-- Nodes -->
    {#each nodeIds as id}
      {@const el = store.model.elements[id]}
      {@const pos = store.positions[id] ?? { x: 0, y: 0 }}
      {@const h = nodeH(id)}
      {@const sel = store.selectedId === id}
      {@const c = nodeColor(el.kind)}
      <g
        class="node-g"
        transform="translate({pos.x} {pos.y})"
        onmousedown={(e) => onNodeMousedown(e, id)}
        onclick={(e) => e.stopPropagation()}
      >
        <rect
          width={NODE_W} height={h} rx="8"
          fill={c.fill} stroke={c.stroke}
          stroke-width={sel ? 3 : 2}
          class="node-rect"
        />
        <text
          x={NODE_W / 2} y="24"
          text-anchor="middle"
          font-family="system-ui,sans-serif"
          font-size="14" font-weight="700"
          fill={c.text}
          class="no-events"
        >{el.name}</text>

        {#if el.attrs.length > 0}
          <line
            x1="0" y1={HEADER_H} x2={NODE_W} y2={HEADER_H}
            stroke={c.stroke} stroke-width="1.5"
          />
          {#each el.attrs as attr, i}
            <text
              x="10" y={HEADER_H + ATTR_PAD + (i + 1) * ATTR_H - 6}
              font-family="system-ui,sans-serif"
              font-size="12" fill="#333"
              class="no-events"
            >{attr.name}: {store.model.elements[attr.typeId]?.name ?? attr.typeId}</text>
          {/each}
        {/if}
      </g>
    {/each}
  </g>
</svg>

<style>
  .svg-canvas {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
    user-select: none;
    background: #fafafa;
  }
  .svg-canvas.panning { cursor: grabbing; }
  .node-g { cursor: move; }
  .node-rect { filter: drop-shadow(0 2px 4px rgba(0,0,0,0.12)); }
  .edge {
    stroke: #b1b1b7;
    stroke-width: 1.5;
    cursor: pointer;
  }
  .edge-sel { stroke: #534ab7; stroke-width: 2.5; }
  .no-events { pointer-events: none; }
</style>
