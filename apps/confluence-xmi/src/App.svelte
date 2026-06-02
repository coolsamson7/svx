<script lang="ts">
  import { getForgeContext, requestConfluence, type ForgeContext } from './forge-context'
  import { parseXmi } from './parser/xmi-parser'
  import { layoutModel } from './layout/elk-layout'
  import { store } from './model/store.svelte'
  import XmiViewer from './components/XmiViewer.svelte'

  const VERSION = 'v4'

  let ctx = $state<ForgeContext | null>(null)
  let error = $state<string | null>(null)
  let loading = $state(true)
  let loadingStage = $state('init')

  $effect(() => {
    const timeout = setTimeout(() => {
      if (loading) error = `Timeout waiting for Forge context (stage: ${loadingStage})`
    }, 8000)

    loadingStage = 'forge-context'
    getForgeContext()
      .then(async (resolved) => {
        loadingStage = 'xmi'
        ctx = resolved
        await loadXmi(resolved)
      })
      .catch((e) => { error = String(e) })
      .finally(() => { loading = false; clearTimeout(timeout) })
  })

  async function loadXmi(context: ForgeContext) {
    let text: string | null = null

    if (context.config.gitlabUrl) {
      const res = await fetch(context.config.gitlabUrl)
      if (!res.ok) throw new Error(`GitLab fetch failed: ${res.status}`)
      text = await res.text()
    } else if (context.config.attachmentName) {
      const res = await requestConfluence(
        `/wiki/rest/api/content/${context.pageId}/child/attachment?filename=${context.config.attachmentName}&expand=version`
      )
      const data = await res.json()
      const attachment = data.results?.[0]
      if (!attachment) return
      const fileRes = await requestConfluence(`/wiki${attachment._links.download}`)
      text = await fileRes.text()
    }

    if (text) {
      const model = parseXmi(text)
      const positions = await layoutModel(model, 'layered')
      store.load(model, positions)
    }
  }

  const height = $derived(ctx?.config.height ?? 600)
</script>

<div class="container" style="height: {height}px">
  {#if loading}
    <div class="state">Loading… [{VERSION} / {loadingStage}]</div>

  {:else if error}
    <div class="state error">Failed to load: {error}</div>

  {:else if store.model.order.length === 0}
    <div class="state muted">
      No model found.<br />
      Attach a <strong>model.xmi</strong> file to this page, or edit the macro to set a GitLab URL.
    </div>

  {:else}
    <XmiViewer />
  {/if}
</div>

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
  }
  .container {
    font-family: system-ui, sans-serif;
    display: flex;
    align-items: stretch;
    overflow: hidden;
  }
  .state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: #666;
    text-align: center;
    line-height: 1.6;
  }
  .state.error { color: #cc0000; }
  .state.muted  { color: #aaaaaa; }
</style>
