import ELK from 'elkjs/lib/elk.bundled.js'
import type { UmlModel, UmlAssociation } from '../model/types'

const elk = new ELK()

const NODE_WIDTH = 220
const NODE_HEIGHT_BASE = 60
const NODE_HEIGHT_PER_ATTR = 24
const PKG_PADDING = 30
const PKG_HEADER = 42  // height of the package header bar

export interface LayoutResult {
  positions: Record<string, { x: number; y: number }>
  sizes: Record<string, { width: number; height: number }>
}

export async function layoutModel(
  model: UmlModel,
  algorithm: string = 'layered'
): Promise<LayoutResult> {
  // Build parent → children map (non-association elements only)
  const childrenOf = new Map<string | null, string[]>([[null, []]])
  for (const id of model.order) {
    const el = model.elements[id]
    if (!el || el.kind === 'uml:Association') continue
    const p = el.parentId ?? null
    if (!childrenOf.has(p)) childrenOf.set(p, [])
    childrenOf.get(p)!.push(id)
  }

  const childLayoutOpts = {
    'elk.algorithm': algorithm,
    'elk.direction': 'DOWN',
    'elk.spacing.nodeNode': '40',
    'elk.layered.spacing.nodeNodeBetweenLayers': '60',
    'elk.padding': `[top=${PKG_HEADER + PKG_PADDING},left=${PKG_PADDING},bottom=${PKG_PADDING},right=${PKG_PADDING}]`,
  }

  function buildElkNode(id: string): object {
    const el = model.elements[id]!
    const children = (childrenOf.get(id) ?? []).map(buildElkNode)
    if (el.kind === 'uml:Package') {
      return { id, children, layoutOptions: childLayoutOpts }
    }
    const height = NODE_HEIGHT_BASE + (el.attrs?.length ?? 0) * NODE_HEIGHT_PER_ATTR
    return { id, width: NODE_WIDTH, height }
  }

  const rootChildren = (childrenOf.get(null) ?? []).map(buildElkNode)

  // All association edges (SvelteFlow/ELK handles cross-package routing)
  const elkEdges = model.order
    .filter(id => model.elements[id]?.kind === 'uml:Association')
    .map(id => {
      const el = model.elements[id] as UmlAssociation
      return { id, sources: [el.ends[0].typeId], targets: [el.ends[1].typeId] }
    })
    .filter(e => e.sources[0] && e.targets[0] && model.elements[e.sources[0]] && model.elements[e.targets[0]])

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': algorithm,
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    },
    children: rootChildren,
    edges: elkEdges,
  }

  const result = await elk.layout(graph as any)

  const positions: Record<string, { x: number; y: number }> = {}
  const sizes: Record<string, { width: number; height: number }> = {}

  function extract(nodes: any[]) {
    for (const node of nodes ?? []) {
      positions[node.id] = { x: node.x ?? 0, y: node.y ?? 0 }
      if (model.elements[node.id]?.kind === 'uml:Package' && node.width && node.height) {
        sizes[node.id] = { width: node.width, height: node.height }
      }
      extract(node.children)
    }
  }
  extract(result.children ?? [])

  return { positions, sizes }
}
