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

      // For nodes inside packages, `position` is relative to the parent.
      // `internals.positionAbsolute` is always the absolute flow coordinate.
      const abs = (node as any).internals?.positionAbsolute ?? node.position

      const container = document.querySelector('.svelte-flow')
      const cw = container?.clientWidth ?? 800
      const ch = container?.clientHeight ?? 600

      const tl = flowToScreenPosition(abs)
      const br = flowToScreenPosition({ x: abs.x + w, y: abs.y + h })

      const inView =
        tl.x > MARGIN && tl.y > MARGIN &&
        br.x < cw - MARGIN && br.y < ch - MARGIN

      if (!inView) {
        setCenter(
          abs.x + w / 2,
          abs.y + h / 2,
          { zoom: getZoom(), duration: 300 },
        )
      }
    })
  })
</script>
