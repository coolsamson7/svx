<script lang="ts">
  import { untrack } from 'svelte'
  import { useSvelteFlow } from '@xyflow/svelte'
  import { store } from '../model/store.svelte'

  const { getNode, getZoom, setCenter } = useSvelteFlow()

  $effect(() => {
    const id = store.selectedId
    if (!id) return
    untrack(() => {
      const node = getNode(id)
      if (!node) return
      const w = node.measured?.width ?? node.width ?? 200
      const h = node.measured?.height ?? node.height ?? 100
      setCenter(
        node.position.x + w / 2,
        node.position.y + h / 2,
        { zoom: getZoom(), duration: 400 },
      )
    })
  })
</script>
