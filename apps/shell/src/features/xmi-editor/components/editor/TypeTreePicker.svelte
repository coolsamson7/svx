<script lang="ts">
  import { store } from '../../model/store.svelte'
  import type { UmlKind } from '../../model/types'

  interface Props {
    value: string
    targets: UmlKind[]
    onchange: (id: string) => void
  }

  let { value, targets, onchange }: Props = $props()

  let open = $state(false)
  let containerEl = $state<HTMLElement | null>(null)

  // Build the tree: packages with their target elements as children
  interface TreePackage {
    id: string
    name: string
    parentId?: string
    children: TreePackage[]
    items: { id: string; name: string; description?: string }[]
  }

  const tree = $derived((): TreePackage[] => {
    const model = store.model

    // Build package nodes
    const pkgMap = new Map<string, TreePackage>()
    for (const id of model.order) {
      const el = model.elements[id]
      if (!el || el.kind !== 'uml:Package') continue
      pkgMap.set(id, { id, name: el.name, parentId: el.parentId, children: [], items: [] })
    }

    // Wire package parent/child
    const roots: TreePackage[] = []
    for (const [, pkg] of pkgMap) {
      if (pkg.parentId && pkgMap.has(pkg.parentId)) {
        pkgMap.get(pkg.parentId)!.children.push(pkg)
      } else {
        roots.push(pkg)
      }
    }

    // Place target elements into their package (or a synthetic root group)
    const rootItems: { id: string; name: string; description?: string }[] = []
    for (const id of model.order) {
      const el = model.elements[id]
      if (!el || !targets.includes(el.kind)) continue
      if (el.parentId && pkgMap.has(el.parentId)) {
        pkgMap.get(el.parentId)!.items.push({ id: el.id, name: el.name, description: el.description })
      } else {
        rootItems.push({ id: el.id, name: el.name, description: el.description })
      }
    }

    // Prune empty packages (no items in self or descendants)
    function hasContent(pkg: TreePackage): boolean {
      return pkg.items.length > 0 || pkg.children.some(hasContent)
    }

    const pruned = roots.filter(hasContent)
    if (rootItems.length > 0) {
      pruned.unshift({ id: '__root__', name: '(root)', parentId: undefined, children: [], items: rootItems })
    }
    return pruned
  })

  // Collapsed state per package id
  let collapsed = $state<Record<string, boolean>>({})

  function togglePkg(id: string) {
    collapsed[id] = !collapsed[id]
  }

  function select(id: string) {
    onchange(id)
    open = false
  }

  function clearSelection() {
    onchange('')
    open = false
  }

  // Label for currently selected value
  const selectedLabel = $derived(() => {
    if (!value) return '—'
    return store.model.elements[value]?.name ?? value
  })

  // Close on outside click
  function handleDocClick(e: MouseEvent) {
    if (containerEl && !containerEl.contains(e.target as Node)) {
      open = false
    }
  }

  $effect(() => {
    if (open) {
      document.addEventListener('click', handleDocClick)
      return () => document.removeEventListener('click', handleDocClick)
    }
  })
</script>

<div class="tree-picker" bind:this={containerEl}>
  <button class="trigger" onclick={() => open = !open} type="button">
    <span class="trigger-label">{selectedLabel()}</span>
    <span class="chevron">{open ? '▲' : '▼'}</span>
  </button>

  {#if open}
    <div class="dropdown">
      <div class="item clear-item" onclick={clearSelection}>—</div>
      {#each tree() as pkg}
        {@render renderPkg(pkg, 0)}
      {/each}
    </div>
  {/if}
</div>

{#snippet renderPkg(pkg: any, depth: number)}
  {#if pkg.children.length > 0 || pkg.items.length > 0}
    {#if pkg.id !== '__root__'}
      <div
        class="pkg-header"
        style="padding-left: {8 + depth * 14}px"
        onclick={() => togglePkg(pkg.id)}
      >
        <span class="pkg-toggle">{collapsed[pkg.id] ? '▶' : '▼'}</span>
        <span class="pkg-name">{pkg.name}</span>
      </div>
    {/if}
    {#if !collapsed[pkg.id]}
      {#each pkg.children as child}
        {@render renderPkg(child, depth + 1)}
      {/each}
      {#each pkg.items as item}
        <div
          class="item"
          class:selected={item.id === value}
          style="padding-left: {(pkg.id === '__root__' ? 8 : 22) + depth * 14}px"
          title={item.description ?? ''}
          onclick={() => select(item.id)}
        >{item.name}</div>
      {/each}
    {/if}
  {/if}
{/snippet}

<style>
  .tree-picker {
    position: relative;
    width: 100%;
  }
  .trigger {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 13px;
    text-align: left;
    color: #24292f;
  }
  .trigger:focus { outline: none; border-color: #534AB7; }
  .trigger-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chevron { font-size: 10px; color: #888; flex-shrink: 0; margin-left: 4px; }
  .dropdown {
    position: absolute;
    top: calc(100% + 2px);
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #d0d7de;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    z-index: 1000;
    max-height: 280px;
    overflow-y: auto;
    font-size: 12px;
  }
  .pkg-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 8px;
    background: #f6f8fa;
    color: #57606a;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    user-select: none;
    border-bottom: 1px solid #f0f0f0;
  }
  .pkg-header:hover { background: #eef0f3; }
  .pkg-toggle { font-size: 9px; width: 10px; flex-shrink: 0; }
  .pkg-name { }
  .item {
    padding: 5px 8px;
    cursor: pointer;
    color: #24292f;
    border-bottom: 1px solid #f8f8f8;
  }
  .item:hover { background: #f0eeff; }
  .item.selected { background: #eeedfe; font-weight: 600; color: #3C3489; }
  .clear-item { color: #888; font-style: italic; padding: 5px 8px; border-bottom: 1px solid #eee; }
  .clear-item:hover { background: #fafafa; }
</style>
