import type { UmlModel, UmlElement, UmlKind, UmlAttribute, UmlAssociation } from './types'

class XmiStore {
  past = $state<UmlModel[]>([{ elements: {}, order: [] }])
  future = $state<UmlModel[]>([])
  positions = $state<Record<string, { x: number; y: number }>>({})
  sizes = $state<Record<string, { width: number; height: number }>>({})
  selectedId = $state<string | null>(null)

  get model(): UmlModel { return this.past[this.past.length - 1] }
  get canUndo() { return this.past.length > 1 }
  get canRedo() { return this.future.length > 0 }

  private push(next: UmlModel) {
    this.past = [...this.past, next]
    this.future = []
  }

  load(
    model: UmlModel,
    positions: Record<string, { x: number; y: number }>,
    sizes: Record<string, { width: number; height: number }> = {},
  ) {
    this.past = [model]
    this.future = []
    this.positions = positions
    this.sizes = sizes
    this.selectedId = null
  }

  undo() {
    if (this.past.length <= 1) return
    this.future = [this.model, ...this.future]
    this.past = this.past.slice(0, -1)
  }

  redo() {
    if (this.future.length === 0) return
    this.past = [...this.past, this.future[0]]
    this.future = this.future.slice(1)
  }

  updateElement(id: string, patch: Partial<UmlElement>) {
    const m = this.model
    this.push({ ...m, elements: { ...m.elements, [id]: { ...m.elements[id], ...patch } } })
  }

  updateAttribute(elementId: string, attrId: string, patch: Partial<UmlAttribute>) {
    const m = this.model
    const el = m.elements[elementId]
    this.push({
      ...m,
      elements: {
        ...m.elements,
        [elementId]: { ...el, attrs: el.attrs.map(a => a.id === attrId ? { ...a, ...patch } : a) }
      }
    })
  }

  addAttribute(elementId: string, attr: UmlAttribute) {
    const m = this.model
    const el = m.elements[elementId]
    this.push({ ...m, elements: { ...m.elements, [elementId]: { ...el, attrs: [...el.attrs, attr] } } })
  }

  deleteAttribute(elementId: string, attrId: string) {
    const m = this.model
    const el = m.elements[elementId]
    this.push({ ...m, elements: { ...m.elements, [elementId]: { ...el, attrs: el.attrs.filter(a => a.id !== attrId) } } })
  }

  reorderAttributes(elementId: string, newOrder: UmlAttribute[]) {
    const m = this.model
    const el = m.elements[elementId]
    this.push({ ...m, elements: { ...m.elements, [elementId]: { ...el, attrs: newOrder } } })
  }

  deleteElement(id: string) {
    const m = this.model
    // Cascade: also delete all descendants of a package
    const toDelete = new Set<string>([id])
    const cascade = (pid: string) => {
      for (const [eid, el] of Object.entries(m.elements)) {
        if (el.parentId === pid && !toDelete.has(eid)) {
          toDelete.add(eid)
          cascade(eid)
        }
      }
    }
    if (m.elements[id]?.kind === 'uml:Package') cascade(id)

    const elements = Object.fromEntries(Object.entries(m.elements).filter(([k]) => !toDelete.has(k)))
    this.push({ elements, order: m.order.filter(o => !toDelete.has(o)) })
    if (toDelete.has(this.selectedId ?? '')) this.selectedId = null
  }

  moveNode(id: string, x: number, y: number) {
    this.positions = { ...this.positions, [id]: { x, y } }
  }

  setSize(id: string, width: number, height: number) {
    this.sizes = { ...this.sizes, [id]: { width, height } }
  }

  addElement(kind: UmlKind, name?: string, parentId?: string): string {
    if (kind === 'uml:Association') throw new Error('Use addAssociation')
    const id = crypto.randomUUID()
    const m = this.model
    const label = name ?? this.#defaultName(kind, m)
    const el: UmlElement = { id, name: label, kind, tags: {}, attrs: [], parentId }
    const count = m.order.length
    this.push({ ...m, elements: { ...m.elements, [id]: el }, order: [...m.order, id] })
    if (parentId) {
      // Position relative to parent, inside the package
      this.positions = { ...this.positions, [id]: { x: 20, y: 50 } }
    } else {
      this.positions = { ...this.positions, [id]: { x: 80 + (count % 5) * 240, y: 80 + Math.floor(count / 5) * 200 } }
    }
    this.selectedId = id
    return id
  }

  addAssociation(sourceId: string, targetId: string): string {
    const id = crypto.randomUUID()
    const m = this.model
    const assoc: UmlAssociation = {
      id, name: '', kind: 'uml:Association', tags: {}, attrs: [],
      ends: [
        { id: crypto.randomUUID(), role: '', typeId: sourceId, lower: '0', upper: '*', navigable: true },
        { id: crypto.randomUUID(), role: '', typeId: targetId, lower: '0', upper: '*', navigable: true },
      ],
    }
    this.push({ ...m, elements: { ...m.elements, [id]: assoc }, order: [...m.order, id] })
    this.selectedId = id
    return id
  }

  updateAssocEnd(assocId: string, endIdx: 0 | 1, patch: Partial<import('./types').AssocEnd>) {
    const m = this.model
    const assoc = m.elements[assocId] as UmlAssociation
    if (!assoc) return
    const ends = [{ ...assoc.ends[0] }, { ...assoc.ends[1] }] as [import('./types').AssocEnd, import('./types').AssocEnd]
    ends[endIdx] = { ...ends[endIdx], ...patch }
    this.push({ ...m, elements: { ...m.elements, [assocId]: { ...assoc, ends } } })
  }

  #defaultName(kind: string, m: UmlModel): string {
    const prefix = kind === 'uml:Class' ? 'Class' : kind === 'uml:DataType' ? 'DataType' : kind === 'uml:Package' ? 'Package' : 'Primitive'
    const existing = new Set(Object.values(m.elements).map(e => e.name))
    let i = 1
    while (existing.has(`${prefix}${i}`)) i++
    return `${prefix}${i}`
  }
}

export const store = new XmiStore()
