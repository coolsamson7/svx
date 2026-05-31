import type { UmlKind } from './types'

export type FieldType = 'text' | 'number' | 'boolean' | 'select' | 'ref'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  options?: string[]
  targets?: UmlKind[]
  required?: boolean
}

export interface ElementSchema {
  fields: FieldDef[]
  allowExtraTaggedValues: boolean
}

export const schema: Record<UmlKind, ElementSchema> = {
  'uml:Class': {
    allowExtraTaggedValues: true,
    fields: [
      { key: 'name', label: 'Class name', type: 'text', required: true },
      { key: 'baseType', label: 'Superclass', type: 'ref', targets: ['uml:Class'] },
      { key: 'description', label: 'Description', type: 'text' },
    ]
  },
  'uml:DataType': {
    allowExtraTaggedValues: true,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'baseType', label: 'Base primitive', type: 'ref', targets: ['uml:PrimitiveType'] },
      { key: 'description', label: 'Description', type: 'text' },
    ]
  },
  'uml:PrimitiveType': {
    allowExtraTaggedValues: false,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
    ]
  },
  'uml:Package': {
    allowExtraTaggedValues: false,
    fields: [
      { key: 'name', label: 'Package name', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'text' },
    ]
  },
  'uml:Association': {
    allowExtraTaggedValues: false,
    fields: []
  }
}

export const attributeSchema: FieldDef[] = [
  { key: 'name', label: 'Attribute name', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'typeId', label: 'Type', type: 'ref', targets: ['uml:PrimitiveType', 'uml:DataType'] },
  { key: 'tags.nullable', label: 'Nullable', type: 'boolean' },
  { key: 'tags.primary-key', label: 'Primary key', type: 'boolean' },
  { key: 'tags.generated', label: 'Generated', type: 'boolean' },
  { key: 'tags.unique', label: 'Unique', type: 'boolean' },
]
