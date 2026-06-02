<script lang="ts">
  import { untrack } from 'svelte'
  import { useSvelteFlow } from '@xyflow/svelte'
  import { store } from '../model/store.svelte'

  const { getNode, getZoom, setCenter, flowToScreenPosition } = useSvelteFlow()

  const MARGIN = 80

  $effect(() => {
    const id = store.selectedId
    if (!id) return
    untrack(() => {
      const node = getNode(id)
      if (!node) return
      const w = node.measured?.width ?? node.width ?? 200
      const h = node.measured?.height ?? node.height ?? 100

      // Measure the actual SvelteFlow container — not window, which includes panels/sidebars
      const container = document.querySelector('.svelte-flow')
      const cw = container?.clientWidth ?? 800
      const ch = container?.clientHeight ?? 600

      // flowToScreenPosition returns coords relative to the SvelteFlow container
      const tl = flowToScreenPosition(node.position)
      const br = flowToScreenPosition({ x: node.position.x + w, y: node.position.y + h })

      const inView =
        tl.x > MARGIN && tl.y > MARGIN &&
        br.x < cw - MARGIN && br.y < ch - MARGIN

      if (!inView) {
        setCenter(
          node.position.x + w / 2,
          node.position.y + h / 2,
          { zoom: getZoom(), duration: 300 },
        )
      }
    })
  })
</script>
