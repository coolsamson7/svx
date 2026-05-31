<script lang="ts">
  import { untrack } from 'svelte'
  import { useSvelteFlow } from '@xyflow/svelte'
  import { store } from '../model/store.svelte'

  const { getNode, getZoom, setCenter, flowToScreenPosition } = useSvelteFlow()

  const MARGIN = 60

  $effect(() => {
    const id = store.selectedId
    if (!id) return
    untrack(() => {
      const node = getNode(id)
      if (!node) return
      const w = node.measured?.width ?? node.width ?? 200
      const h = node.measured?.height ?? node.height ?? 100

      // Convert node corners to screen coordinates (relative to SvelteFlow container)
      const tl = flowToScreenPosition(node.position)
      const br = flowToScreenPosition({ x: node.position.x + w, y: node.position.y + h })

      // Use window size as a proxy for the SvelteFlow container (minus any open side panels)
      const vw = window.innerWidth
      const vh = window.innerHeight

      const inView =
        tl.x > MARGIN && tl.y > MARGIN &&
        br.x < vw - MARGIN && br.y < vh - MARGIN

      if (!inView) {
        setCenter(
          node.position.x + w / 2,
          node.position.y + h / 2,
          { zoom: getZoom(), duration: 350 },
        )
      }
    })
  })
</script>
