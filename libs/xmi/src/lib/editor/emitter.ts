import type { UmlModel, UmlElement, UmlAssociation } from './types.js'

function xmlEscape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function attr(name: string, value: string) {
  return ` ${name}="${xmlEscape(value)}"`
}

interface TreeNode {
  el: UmlElement
  children: TreeNode[]
}

function buildTree(model: UmlModel): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  // Create tree nodes for all non-association elements (preserving order)
  for (const id of model.order) {
    const el = model.elements[id]
    if (!el || el.kind === 'uml:Association') continue
    nodeMap.set(id, { el, children: [] })
  }

  // Wire up parent/child relationships
  for (const [, node] of nodeMap) {
    if (node.el.parentId && nodeMap.has(node.el.parentId)) {
      nodeMap.get(node.el.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

export function emitXmi(model: UmlModel): string {
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<xmi:XMI xmi:version="2.1"')
  lines.push('  xmlns:xmi="http://schema.omg.org/spec/XMI/2.1"')
  lines.push('  xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML">')
  lines.push('')

  // Collect primitives (always flat at root level)
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

  // Emit package tree (excludes primitives and associations)
  const roots = buildTree(model).filter(n => n.el.kind !== 'uml:PrimitiveType')
  for (const node of roots) {
    emitTreeNode(node, '  ', lines)
  }

  // Associations always at root level
  const assocIds = model.order.filter(id => model.elements[id]?.kind === 'uml:Association')
  if (assocIds.length > 0) {
    lines.push('  <!-- Associations -->')
    for (const id of assocIds) {
      const el = model.elements[id] as UmlAssociation
      if (!el) continue
      lines.push(`  <packagedElement xmi:type="uml:Association"${attr('xmi:id', el.id)}${attr('name', el.name ?? '')}>`)
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

function emitTreeNode(node: TreeNode, indent: string, lines: string[]) {
  const { el } = node

  if (el.kind === 'uml:Package') {
    lines.push(`${indent}<packagedElement xmi:type="uml:Package"${attr('xmi:id', el.id)}${attr('name', el.name)}>`)
    if (el.description) {
      lines.push(`${indent}  <ownedComment xmi:type="uml:Comment"><body>${xmlEscape(el.description)}</body></ownedComment>`)
    }
    for (const child of node.children) {
      emitTreeNode(child, indent + '  ', lines)
    }
    lines.push(`${indent}</packagedElement>`)
    lines.push('')
    return
  }

  if (el.kind === 'uml:DataType') {
    const tvEntries = Object.entries(el.tags)
    const hasChildren = el.baseType || tvEntries.length > 0 || el.description
    if (hasChildren) {
      lines.push(`${indent}<packagedElement xmi:type="uml:DataType"${attr('xmi:id', el.id)}${attr('name', el.name)}>`)
      if (el.description) {
        lines.push(`${indent}  <ownedComment xmi:type="uml:Comment"><body>${xmlEscape(el.description)}</body></ownedComment>`)
      }
      if (el.baseType) {
        lines.push(`${indent}  <generalization xmi:type="uml:Generalization"${attr('xmi:id', el.id + '_gen')}${attr('general', el.baseType)}/>`)
      }
      for (const [tag, value] of tvEntries) {
        lines.push(`${indent}  <taggedValue${attr('tag', tag)}${attr('value', value)}/>`)
      }
      lines.push(`${indent}</packagedElement>`)
    } else {
      lines.push(`${indent}<packagedElement xmi:type="uml:DataType"${attr('xmi:id', el.id)}${attr('name', el.name)}/>`)
    }
    return
  }

  if (el.kind === 'uml:Class') {
    lines.push(`${indent}<packagedElement xmi:type="uml:Class"${attr('xmi:id', el.id)}${attr('name', el.name)}>`)
    if (el.description) {
      lines.push(`${indent}  <ownedComment xmi:type="uml:Comment"><body>${xmlEscape(el.description)}</body></ownedComment>`)
    }
    if (el.baseType) {
      lines.push(`${indent}  <generalization xmi:type="uml:Generalization"${attr('xmi:id', el.id + '_gen')}${attr('general', el.baseType)}/>`)
    }
    for (const [tag, value] of Object.entries(el.tags)) {
      lines.push(`${indent}  <taggedValue${attr('tag', tag)}${attr('value', value)}/>`)
    }
    for (const a of el.attrs ?? []) {
      lines.push(`${indent}  <ownedAttribute xmi:type="uml:Property"${attr('xmi:id', a.id)}${attr('name', a.name)}>`)
      if (a.description) {
        lines.push(`${indent}    <ownedComment xmi:type="uml:Comment"><body>${xmlEscape(a.description)}</body></ownedComment>`)
      }
      if (a.typeId) lines.push(`${indent}    <type xmi:idref="${xmlEscape(a.typeId)}"/>`)
      for (const [tag, value] of Object.entries(a.tags ?? {})) {
        lines.push(`${indent}    <taggedValue${attr('tag', tag)}${attr('value', value)}/>`)
      }
      lines.push(`${indent}  </ownedAttribute>`)
    }
    lines.push(`${indent}</packagedElement>`)
    lines.push('')
  }
}
