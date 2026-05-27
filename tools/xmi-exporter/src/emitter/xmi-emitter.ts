import { UmlModel, UmlClass, UmlDataType, UmlAttribute, UmlAssociation, TaggedValue, Multiplicity } from '../model';

/* ------------------------------------------------------------------ */
/* XML helpers                                                           */
/* ------------------------------------------------------------------ */

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attr(name: string, value: string): string {
  return ` ${name}="${xmlEscape(value)}"`;
}

/* ------------------------------------------------------------------ */
/* Multiplicity → lower/upper values                                    */
/* ------------------------------------------------------------------ */

function multBounds(m: Multiplicity): { lower: string; upper: string } {
  switch (m) {
    case '0..1': return { lower: '0', upper: '1' };
    case '1':    return { lower: '1', upper: '1' };
    case '0..*': return { lower: '0', upper: '*' };
    case '1..*': return { lower: '1', upper: '*' };
  }
}

function emitMultiplicity(id: string, m: Multiplicity, indent: string): string {
  const { lower, upper } = multBounds(m);
  return [
    `${indent}<lowerValue xmi:type="uml:LiteralInteger"${attr('xmi:id', id + '_lower')}${attr('value', lower)}/>`,
    `${indent}<upperValue xmi:type="uml:LiteralUnlimitedNatural"${attr('xmi:id', id + '_upper')}${attr('value', upper)}/>`,
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* Tagged values                                                         */
/* ------------------------------------------------------------------ */

function emitTaggedValues(tags: TaggedValue[], indent: string): string {
  return tags
    .map(t => `${indent}<taggedValue${attr('tag', t.tag)}${attr('value', t.value)}/>`)
    .join('\n');
}

/* ------------------------------------------------------------------ */
/* Collect used UML primitives                                           */
/* ------------------------------------------------------------------ */

const UML_PRIMITIVES = new Set(['String', 'Integer', 'Boolean', 'DateTime']);

function collectPrimitives(model: UmlModel): Set<string> {
  const used = new Set<string>();
  for (const cls of model.classes) {
    for (const a of cls.attributes) {
      if (!a.isRef && UML_PRIMITIVES.has(a.typeRef)) used.add(a.typeRef);
    }
  }
  for (const dt of model.dataTypes) {
    if (dt.baseType && UML_PRIMITIVES.has(dt.baseType)) used.add(dt.baseType);
  }
  return used;
}

/* ------------------------------------------------------------------ */
/* Main emitter                                                          */
/* ------------------------------------------------------------------ */

export function emitXmi(model: UmlModel): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<xmi:XMI xmi:version="2.1"');
  lines.push('  xmlns:xmi="http://schema.omg.org/spec/XMI/2.1"');
  lines.push('  xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML">');
  lines.push('');

  // UML Primitives
  const usedPrimitives = collectPrimitives(model);
  if (usedPrimitives.size > 0) {
    lines.push('  <!-- UML primitives -->');
    for (const prim of [...usedPrimitives].sort()) {
      lines.push(`  <packagedElement xmi:type="uml:PrimitiveType"${attr('xmi:id', prim)}${attr('name', prim)}/>`);
    }
    lines.push('');
  }

  // DataTypes
  if (model.dataTypes.length > 0) {
    lines.push('  <!-- DataTypes -->');
    for (const dt of model.dataTypes) {
      const hasChildren = dt.baseType || dt.taggedValues.length > 0;
      if (hasChildren) {
        lines.push(`  <packagedElement xmi:type="uml:DataType"${attr('xmi:id', dt.id)}${attr('name', dt.name)}>`);
        if (dt.baseType) {
          lines.push(`    <generalization xmi:type="uml:Generalization"${attr('xmi:id', dt.id + '_gen')}${attr('general', dt.baseType)}/>`);
        }
        if (dt.taggedValues.length > 0) lines.push(emitTaggedValues(dt.taggedValues, '    '));
        lines.push('  </packagedElement>');
      } else {
        lines.push(`  <packagedElement xmi:type="uml:DataType"${attr('xmi:id', dt.id)}${attr('name', dt.name)}/>`);
      }
    }
    lines.push('');
  }

  // Classes
  if (model.classes.length > 0) {
    lines.push('  <!-- Classes -->');
    for (const cls of model.classes) {
      lines.push(emitClass(cls));
      lines.push('');
    }
  }

  // Associations
  if (model.associations.length > 0) {
    lines.push('  <!-- Associations -->');
    for (const assoc of model.associations) {
      lines.push(emitAssociation(assoc));
      lines.push('');
    }
  }

  lines.push('</xmi:XMI>');

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Class element                                                         */
/* ------------------------------------------------------------------ */

function emitClass(cls: UmlClass): string {
  const lines: string[] = [];

  lines.push(`  <packagedElement xmi:type="uml:Class"${attr('xmi:id', cls.id)}${attr('name', cls.name)}>`);

  if (cls.taggedValues.length > 0) {
    lines.push(emitTaggedValues(cls.taggedValues, '    '));
  }

  for (const a of cls.attributes) {
    lines.push(emitAttribute(a));
  }

  lines.push('  </packagedElement>');

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Attribute element                                                     */
/* ------------------------------------------------------------------ */

function emitAttribute(a: UmlAttribute): string {
  const lines: string[] = [];

  lines.push(`    <ownedAttribute xmi:type="uml:Property"${attr('xmi:id', a.id)}${attr('name', a.name)}>`);

  if (a.isRef) {
    lines.push(`      <type xmi:idref="${xmlEscape(a.typeRef)}"/>`);
  } else {
    lines.push(`      <type xmi:idref="${xmlEscape(a.typeRef)}"/>`);
  }

  if (a.taggedValues.length > 0) {
    lines.push(emitTaggedValues(a.taggedValues, '      '));
  }

  lines.push('    </ownedAttribute>');

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Association element                                                   */
/* ------------------------------------------------------------------ */

function emitAssociation(assoc: UmlAssociation): string {
  const lines: string[] = [];

  const srcEndId = assoc.id + '_src';
  const tgtEndId = assoc.id + '_tgt';

  lines.push(`  <packagedElement xmi:type="uml:Association"${attr('xmi:id', assoc.id)}${attr('name', '')}>`);

  // Source end
  lines.push(`    <ownedEnd xmi:type="uml:Property"${attr('xmi:id', srcEndId)}${attr('name', assoc.sourceRole)}${attr('type', assoc.sourceId)}>`);
  lines.push(emitMultiplicity(srcEndId, assoc.sourceMult, '      '));
  lines.push('    </ownedEnd>');

  // Target end
  lines.push(`    <ownedEnd xmi:type="uml:Property"${attr('xmi:id', tgtEndId)}${attr('name', assoc.targetRole)}${attr('type', assoc.targetId)}>`);
  lines.push(emitMultiplicity(tgtEndId, assoc.targetMult, '      '));
  lines.push('    </ownedEnd>');

  if (assoc.taggedValues.length > 0) {
    lines.push(emitTaggedValues(assoc.taggedValues, '    '));
  }

  lines.push('  </packagedElement>');

  return lines.join('\n');
}
