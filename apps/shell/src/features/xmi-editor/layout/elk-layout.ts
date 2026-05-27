import ELK from 'elkjs/lib/elk.bundled.js'
import type { UmlModel } from '../model/types'

const elk = new ELK()

const NODE_WIDTH = 220
const NODE_HEIGHT_BASE = 60
const NODE_HEIGHT_PER_ATTR = 24

export async function layoutModel(
  model: UmlModel,
  algorithm: string = 'layered'
): Promise<Record<string, { x: number; y: number }>> {
  const nonAssoc = model.order.filter(id => model.elements[id]?.kind !== 'uml:Association')
  const assocs = model.order.filter(id => model.elements[id]?.kind === 'uml:Association')

  const elkNodes = nonAssoc.map(id => {
    const el = model.elements[id]
    const height = NODE_HEIGHT_BASE + el.attrs.length * NODE_HEIGHT_PER_ATTR
    return { id, width: NODE_WIDTH, height }
  })

  const elkEdges = assocs.map(id => {
    const el = model.elements[id] as any
    return { id, sources: [el.ends[0].typeId], targets: [el.ends[1].typeId] }
  }).filter(e => e.sources[0] && e.targets[0])

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': algorithm,
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
    },
    children: elkNodes,
    edges: elkEdges,
  }

  const result = await elk.layout(graph as any)
  const positions: Record<string, { x: number; y: number }> = {}
  for (const node of result.children ?? []) {
    positions[node.id] = { x: node.x ?? 0, y: node.y ?? 0 }
  }
  return positions
}
