import { XMLParser } from 'fast-xml-parser'
import type { UmlModel, UmlElement, UmlAttribute, UmlAssociation, AssocEnd } from '../model/types'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['packagedElement', 'ownedAttribute', 'ownedEnd', 'taggedValue', 'generalization'].includes(name),
})

export function parseXmi(xml: string): UmlModel {
  const doc = parser.parse(xml)
  const root = doc['xmi:XMI'] ?? doc
  const elements: Record<string, UmlElement> = {}
  const order: string[] = []

  for (const el of (root.packagedElement ?? [])) {
    const kind = el['@_xmi:type']
    const id = el['@_xmi:id']
    const name = el['@_name'] ?? ''
    if (!id || !kind) continue

    const tags: Record<string, string> = {}
    for (const tv of (el.taggedValue ?? [])) {
      tags[tv['@_tag']] = tv['@_value'] ?? ''
    }

    if (kind === 'uml:Association') {
      const ends = (el.ownedEnd ?? []).slice(0, 2).map((e: any): AssocEnd => ({
        id: e['@_xmi:id'] ?? '',
        role: e['@_name'] ?? '',
        typeId: e['@_type'] ?? '',
        lower: e.lowerValue?.['@_value'] ?? '0',
        upper: e.upperValue?.['@_value'] ?? '*',
      }))
      while (ends.length < 2) ends.push({ id: '', role: '', typeId: '', lower: '0', upper: '*' })
      const assoc: UmlAssociation = {
        id,
        name,
        kind: 'uml:Association',
        tags,
        attrs: [],
        ends: ends as [AssocEnd, AssocEnd],
      }
      elements[id] = assoc
      order.push(id)
    } else {
      const attrs: UmlAttribute[] = []
      for (const oa of (el.ownedAttribute ?? [])) {
        const attrId = oa['@_xmi:id'] ?? ''
        const attrName = oa['@_name'] ?? ''
        const typeId = (oa.type?.['@_xmi:idref']) ?? ''
        const attrTags: Record<string, string> = {}
        for (const tv of (oa.taggedValue ?? [])) {
          attrTags[tv['@_tag']] = tv['@_value'] ?? ''
        }
        attrs.push({ id: attrId, name: attrName, typeId, tags: attrTags })
      }

      // Extract baseType from generalization if present
      const baseType = el.generalization?.[0]?.['@_general']

      elements[id] = { id, name, kind: kind as any, tags, attrs, baseType }
      order.push(id)
    }
  }

  return { elements, order }
}
