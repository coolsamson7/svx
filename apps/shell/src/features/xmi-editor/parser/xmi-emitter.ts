import type { UmlModel, UmlAssociation } from '../model/types'

function xmlEscape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function attr(name: string, value: string) {
  return ` ${name}="${xmlEscape(value)}"`
}

export function emitXmi(model: UmlModel): string {
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<xmi:XMI xmi:version="2.1"')
  lines.push('  xmlns:xmi="http://schema.omg.org/spec/XMI/2.1"')
  lines.push('  xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML">')
  lines.push('')

  const primitives = new Set<string>()
  for (const id of model.order) {
    const el = model.elements[id]
    if (!el) continue
    if (el.kind === 'uml:PrimitiveType') primitives.add(el.id)
    if (el.kind === 'uml:DataType' && el.baseType) primitives.add(el.baseType)
    for (const a of el.attrs) {
      if (!model.elements[a.typeId] && a.typeId) primitives.add(a.typeId)
    }
  }

  if (primitives.size > 0) {
    lines.push('  <!-- UML primitives -->')
    for (const p of [...primitives].sort()) {
      lines.push(`  <packagedElement xmi:type="uml:PrimitiveType"${attr('xmi:id', p)}${attr('name', p)}/>`)
    }
    lines.push('')
  }

  const datatypes = model.order.filter(id => model.elements[id]?.kind === 'uml:DataType')
  if (datatypes.length > 0) {
    lines.push('  <!-- DataTypes -->')
    for (const id of datatypes) {
      const el = model.elements[id]
      if (!el) continue
      const tvEntries = Object.entries(el.tags)
      const hasChildren = el.baseType || tvEntries.length > 0
      if (hasChildren) {
        lines.push(`  <packagedElement xmi:type="uml:DataType"${attr('xmi:id', el.id)}${attr('name', el.name)}>`)
        if (el.baseType) {
          lines.push(`    <generalization xmi:type="uml:Generalization"${attr('xmi:id', el.id + '_gen')}${attr('general', el.baseType)}/>`)
        }
        for (const [tag, value] of tvEntries) {
          lines.push(`    <taggedValue${attr('tag', tag)}${attr('value', value)}/>`)
        }
        lines.push('  </packagedElement>')
      } else {
        lines.push(`  <packagedElement xmi:type="uml:DataType"${attr('xmi:id', el.id)}${attr('name', el.name)}/>`)
      }
    }
    lines.push('')
  }

  const classes = model.order.filter(id => model.elements[id]?.kind === 'uml:Class')
  if (classes.length > 0) {
    lines.push('  <!-- Classes -->')
    for (const id of classes) {
      const el = model.elements[id]
      if (!el) continue
      lines.push(`  <packagedElement xmi:type="uml:Class"${attr('xmi:id', el.id)}${attr('name', el.name)}>`)
      for (const [tag, value] of Object.entries(el.tags)) {
        lines.push(`    <taggedValue${attr('tag', tag)}${attr('value', value)}/>`)
      }
      for (const a of el.attrs) {
        lines.push(`    <ownedAttribute xmi:type="uml:Property"${attr('xmi:id', a.id)}${attr('name', a.name)}>`)
        if (a.typeId) lines.push(`      <type xmi:idref="${xmlEscape(a.typeId)}"/>`)
        for (const [tag, value] of Object.entries(a.tags)) {
          lines.push(`      <taggedValue${attr('tag', tag)}${attr('value', value)}/>`)
        }
        lines.push('    </ownedAttribute>')
      }
      lines.push('  </packagedElement>')
      lines.push('')
    }
  }

  const assocs = model.order.filter(id => model.elements[id]?.kind === 'uml:Association')
  if (assocs.length > 0) {
    lines.push('  <!-- Associations -->')
    for (const id of assocs) {
      const el = model.elements[id] as UmlAssociation
      if (!el) continue
      lines.push(`  <packagedElement xmi:type="uml:Association"${attr('xmi:id', el.id)}${attr('name', '')}>`)
      for (const [i, end] of el.ends.entries()) {
        const endId = end.id || el.id + (i === 0 ? '_src' : '_tgt')
        lines.push(`    <ownedEnd xmi:type="uml:Property"${attr('xmi:id', endId)}${attr('name', end.role)}${attr('type', end.typeId)}>`)
        lines.push(`      <lowerValue xmi:type="uml:LiteralInteger"${attr('xmi:id', endId + '_lower')}${attr('value', end.lower)}/>`)
        lines.push(`      <upperValue xmi:type="uml:LiteralUnlimitedNatural"${attr('xmi:id', endId + '_upper')}${attr('value', end.upper)}/>`)
        lines.push('    </ownedEnd>')
      }
      for (const [tag, value] of Object.entries(el.tags)) {
        lines.push(`    <taggedValue${attr('tag', tag)}${attr('value', value)}/>`)
      }
      lines.push('  </packagedElement>')
      lines.push('')
    }
  }

  lines.push('</xmi:XMI>')
  return lines.join('\n')
}
