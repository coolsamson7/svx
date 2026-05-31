import { XMLParser } from 'fast-xml-parser'
import type { UmlModel, UmlElement, UmlKind, UmlAttribute, UmlAssociation, AssocEnd } from '../model/types'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['packagedElement', 'ownedAttribute', 'ownedEnd', 'memberEnd', 'taggedValue', 'generalization', 'ownedComment'].includes(name),
})

function extractDescription(el: any): string | undefined {
  const comments: any[] = el.ownedComment ?? []
  const body = comments[0]?.body
  return body ? String(body).trim() : undefined
}

export function parseXmi(xml: string): UmlModel {
  const doc = parser.parse(xml)
  const xmiRoot = doc['xmi:XMI'] ?? doc
  // Support both flat (elements directly under xmi:XMI) and wrapped (under uml:Model)
  const modelEl = xmiRoot['uml:Model'] ?? xmiRoot
  const topLevel: any[] = modelEl.packagedElement ?? []

  const elements: Record<string, UmlElement> = {}
  const order: string[] = []
  const attrToOwner: Record<string, string> = {}    // attrId → owning classId
  const rawAttrById:  Record<string, any> = {}      // attrId → raw ownedAttribute element
  const rawAssocs: Array<{ id: string; name: string; tags: Record<string, string>; rawEl: any }> = []

  const KNOWN_NON_PKG_KINDS: ReadonlySet<string> = new Set(['uml:Class', 'uml:DataType', 'uml:PrimitiveType', 'uml:Enumeration'])

  function collectElements(els: any[], parentId: string | undefined = undefined) {
    for (const el of els) {
      const kind: string = el['@_xmi:type'] ?? ''
      const id: string = el['@_xmi:id'] ?? ''
      const name: string = el['@_name'] ?? ''
      if (!id || !kind) continue

      if (kind === 'uml:Package') {
        // Package becomes a real element; children reference it via parentId
        elements[id] = { id, name, kind: 'uml:Package', tags: {}, attrs: [], parentId }
        order.push(id)
        collectElements(el.packagedElement ?? [], id)
        continue
      }

      const tags: Record<string, string> = {}
      for (const tv of (el.taggedValue ?? [])) {
        tags[tv['@_tag']] = tv['@_value'] ?? ''
      }

      if (kind === 'uml:Association') {
        rawAssocs.push({ id, name, tags, rawEl: el })
        continue
      }

      if (!KNOWN_NON_PKG_KINDS.has(kind)) continue

      const attrs: UmlAttribute[] = []
      for (const oa of (el.ownedAttribute ?? [])) {
        const attrId: string = oa['@_xmi:id'] ?? ''
        const attrName: string = oa['@_name'] ?? ''
        const typeId: string = oa.type?.['@_xmi:idref'] ?? ''
        const attrTags: Record<string, string> = {}
        for (const tv of (oa.taggedValue ?? [])) {
          attrTags[tv['@_tag']] = tv['@_value'] ?? ''
        }
        const attrDescription = extractDescription(oa)
        attrs.push({ id: attrId, name: attrName, typeId, tags: attrTags, description: attrDescription })
        if (attrId && id) {
          attrToOwner[attrId] = id
          rawAttrById[attrId] = oa
        }
      }

      const baseType: string | undefined = el.generalization?.[0]?.['@_general']
      const description = extractDescription(el)
      // Treat Enumeration as DataType for visual rendering
      const visualKind = kind === 'uml:Enumeration' ? 'uml:DataType' : kind
      elements[id] = { id, name, kind: visualKind as UmlKind, tags, attrs, baseType, parentId, description }
      order.push(id)
    }
  }

  collectElements(topLevel)

  // Track which attr IDs are association ends (so we can mark them on the owning class)
  const assocEndAttrIds = new Set<string>()

  for (const { id, name, tags, rawEl } of rawAssocs) {
    const ownedEnds: any[] = rawEl.ownedEnd ?? []
    let ends: [AssocEnd, AssocEnd]

    if (ownedEnds.length >= 2) {
      // ownedEnd style: each end has @_type pointing to the participant class
      const mapped = ownedEnds.slice(0, 2).map((e: any): AssocEnd => {
        const endTags: Record<string, string> = {}
        for (const tv of (e.taggedValue ?? [])) endTags[tv['@_tag']] = tv['@_value'] ?? ''
        const role: string = e['@_name'] ?? ''
        const navigable = e['@_isNavigable'] !== 'false'
        return {
          id: e['@_xmi:id'] ?? '',
          role,
          typeId: e['@_type'] ?? '',
          lower: e.lowerValue?.['@_value'] ?? '0',
          upper: e.upperValue?.['@_value'] ?? '*',
          navigable,
          cascade: endTags['cascade'] || undefined,
          onDelete: endTags['on-delete'] || undefined,
        }
      })
      ends = [mapped[0], mapped[1]]
    } else {
      // memberEnd style: refs are ownedAttribute IDs.
      const refs: string[] = (rawEl.memberEnd ?? [])
        .map((m: any) => m['@_xmi:idref'] ?? '')
        .filter(Boolean)
      while (refs.length < 2) refs.push('')
      refs.slice(0, 2).forEach(r => r && assocEndAttrIds.add(r))

      ends = refs.slice(0, 2).map((ref): AssocEnd => {
        const raw = rawAttrById[ref]
        const attrTags: Record<string, string> = {}
        for (const tv of (raw?.taggedValue ?? [])) attrTags[tv['@_tag']] = tv['@_value'] ?? ''
        const role: string = raw?.['@_name'] ?? ''
        const navigable = raw?.['@_isNavigable'] !== 'false'
        return {
          id: ref,
          role,
          typeId: raw?.type?.['@_xmi:idref'] ?? '',
          lower: raw?.lowerValue?.['@_value'] ?? '0',
          upper: raw?.upperValue?.['@_value'] ?? '*',
          navigable,
          cascade: attrTags['cascade'] || undefined,
          onDelete: attrTags['on-delete'] || undefined,
        }
      }) as [AssocEnd, AssocEnd]
    }

    const assoc: UmlAssociation = { id, name, kind: 'uml:Association', tags, attrs: [], ends }
    elements[id] = assoc
    order.push(id)
  }

  // Mark navigation (association-end) attributes on their owning class elements
  for (const attrId of assocEndAttrIds) {
    const ownerId = attrToOwner[attrId]
    if (!ownerId || !elements[ownerId]) continue
    const el = elements[ownerId]
    elements[ownerId] = {
      ...el,
      attrs: el.attrs.map(a => a.id === attrId ? { ...a, isAssociationEnd: true } : a),
    }
  }

  return { elements, order }
}
