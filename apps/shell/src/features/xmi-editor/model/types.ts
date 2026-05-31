export type UmlKind = 'uml:Class' | 'uml:DataType' | 'uml:PrimitiveType' | 'uml:Association' | 'uml:Package'

export interface TaggedValues { [tag: string]: string }

export interface UmlAttribute {
  id: string
  name: string
  typeId: string
  tags: TaggedValues
  description?: string
  isAssociationEnd?: boolean
}

export interface UmlElement {
  id: string
  name: string
  kind: UmlKind
  tags: TaggedValues
  attrs: UmlAttribute[]
  baseType?: string
  parentId?: string  // ID of containing uml:Package element
  description?: string
}

export interface AssocEnd {
  id: string
  /** Property name on the other class. Empty string = not navigable (no accessor generated). */
  role: string
  typeId: string
  lower: string
  upper: string
  /** False = FK column exists but no TS navigation property is generated. Default: true */
  navigable: boolean
  /** ORM-level cascade. 'true' | 'insert' | 'update' | 'remove' | comma-separated combo */
  cascade?: string
  /** DB-level FK ON DELETE. 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' */
  onDelete?: string
}

export interface UmlAssociation extends UmlElement {
  kind: 'uml:Association'
  ends: [AssocEnd, AssocEnd]
}

export interface UmlModel {
  elements: Record<string, UmlElement>
  order: string[]
}
