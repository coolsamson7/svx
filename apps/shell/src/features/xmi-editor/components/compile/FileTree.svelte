<script lang="ts">
  interface Props {
    files: Map<string, string>
    selected: string | null
    onSelect: (path: string) => void
    label?: string
  }

  let { files, selected, onSelect, label }: Props = $props()

  interface TreeNode {
    name: string
    path: string
    children: Map<string, TreeNode>
    isFile: boolean
    content?: string
  }

  function buildTree(files: Map<string, string>): Map<string, TreeNode> {
    const root = new Map<string, TreeNode>()
    for (const [path, content] of files) {
      const parts = path.split('/')
      let current = root
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const isLast = i === parts.length - 1
        const fullPath = parts.slice(0, i + 1).join('/')
        if (!current.has(part)) {
          current.set(part, { name: part, path: fullPath, children: new Map(), isFile: isLast, content: isLast ? content : undefined })
        }
        const node = current.get(part)!
        if (isLast) { node.isFile = true; node.content = content }
        current = node.children
      }
    }
    return root
  }

  const tree = $derived(buildTree(files))

  let collapsed = $state(new Set<string>())
  function toggle(path: string) {
    if (collapsed.has(path)) collapsed.delete(path)
    else collapsed.add(path)
    collapsed = new Set(collapsed)
  }

  function fileIcon(name: string) {
    if (name.endsWith('.ts')) return '󰛦'
    if (name.endsWith('.sql')) return '󰆼'
    if (name.endsWith('.yaml') || name.endsWith('.yml')) return '󰝡'
    if (name.endsWith('.json')) return '󰘦'
    return '󰈙'
  }
</script>

{#snippet renderNode(node: TreeNode, depth: number)}
  {#if node.isFile}
    <button
      class="file-item"
      class:active={selected === node.path}
      style="padding-left: {depth * 14 + 8}px"
      onclick={() => onSelect(node.path)}
    >
      <span class="icon file-icon">{fileIcon(node.name)}</span>
      {node.name}
    </button>
  {:else}
    <button
      class="dir-item"
      style="padding-left: {depth * 14 + 8}px"
      onclick={() => toggle(node.path)}
    >
      <span class="icon">{collapsed.has(node.path) ? '▶' : '▼'}</span>
      {node.name}
    </button>
    {#if !collapsed.has(node.path)}
      {#each [...node.children.values()].sort((a, b) => {
        if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
        return a.name.localeCompare(b.name)
      }) as child}
        {@render renderNode(child, depth + 1)}
      {/each}
    {/if}
  {/if}
{/snippet}

<div class="file-tree">
  {#if label}
    <div class="tree-label">{label}</div>
  {/if}
  {#each [...tree.values()].sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
    return a.name.localeCompare(b.name)
  }) as node}
    {@render renderNode(node, 0)}
  {/each}
</div>

<style>
  .file-tree {
    height: 100%;
    overflow-y: auto;
    background: #f6f8fa;
    border-right: 1px solid #e0e0e0;
    font-size: 12px;
    user-select: none;
  }
  .tree-label {
    padding: 8px 10px 4px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #888;
    font-weight: 600;
  }
  .file-item, .dir-item {
    display: flex;
    align-items: center;
    gap: 5px;
    width: 100%;
    text-align: left;
    border: none;
    background: none;
    padding: 3px 8px;
    cursor: pointer;
    white-space: nowrap;
    font-size: 12px;
    color: #24292f;
  }
  .file-item:hover, .dir-item:hover { background: #e8ecf0; }
  .file-item.active { background: #0969da22; color: #0969da; }
  .dir-item { font-weight: 600; color: #57606a; }
  .icon { width: 14px; text-align: center; flex-shrink: 0; }
  .file-icon { color: #57606a; }
</style>
