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
      { key: 'tags.table-name', label: 'Table name', type: 'text' },
      { key: 'tags.schema', label: 'DB schema', type: 'text' },
    ]
  },
  'uml:DataType': {
    allowExtraTaggedValues: true,
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'baseType', label: 'Base primitive', type: 'ref', targets: ['uml:PrimitiveType'] },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'tags.max-length', label: 'Max length', type: 'number' },
      { key: 'tags.min-length', label: 'Min length', type: 'number' },
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
    allowExtraTaggedValues: true,
    fields: [
      { key: 'ends.0.role', label: 'Source role', type: 'text' },
      { key: 'ends.0.lower', label: 'Source lower', type: 'text' },
      { key: 'ends.0.upper', label: 'Source upper', type: 'text' },
      { key: 'ends.1.role', label: 'Target role', type: 'text' },
      { key: 'ends.1.lower', label: 'Target lower', type: 'text' },
      { key: 'ends.1.upper', label: 'Target upper', type: 'text' },
      { key: 'tags.cascade', label: 'Cascade', type: 'boolean' },
    ]
  }
}

export const attributeSchema: FieldDef[] = [
  { key: 'name', label: 'Attribute name', type: 'text', required: true },
  { key: 'description', label: 'Description', type: 'text' },
  { key: 'typeId', label: 'Type', type: 'ref', targets: ['uml:PrimitiveType', 'uml:DataType'] },
  { key: 'tags.column-name', label: 'Column name', type: 'text' },
  { key: 'tags.column-type', label: 'Column type', type: 'select', options: ['varchar','int','bigint','boolean','timestamp','timestamptz','text','uuid','jsonb','decimal'] },
  { key: 'tags.nullable', label: 'Nullable', type: 'boolean' },
  { key: 'tags.primary-key', label: 'Primary key', type: 'boolean' },
  { key: 'tags.generated', label: 'Generated', type: 'boolean' },
  { key: 'tags.unique', label: 'Unique', type: 'boolean' },
]
