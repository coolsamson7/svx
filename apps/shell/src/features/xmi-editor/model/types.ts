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
  role: string
  typeId: string
  lower: string
  upper: string
}

export interface UmlAssociation extends UmlElement {
  kind: 'uml:Association'
  ends: [AssocEnd, AssocEnd]
}

export interface UmlModel {
  elements: Record<string, UmlElement>
  order: string[]
}
