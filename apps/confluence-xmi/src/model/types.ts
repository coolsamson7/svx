export type UmlKind = 'uml:Class' | 'uml:DataType' | 'uml:PrimitiveType' | 'uml:Association'

export interface TaggedValues { [tag: string]: string }

export interface UmlAttribute {
  id: string
  name: string
  typeId: string
  tags: TaggedValues
}

export interface UmlElement {
  id: string
  name: string
  kind: UmlKind
  tags: TaggedValues
  attrs: UmlAttribute[]
  baseType?: string   // for DataType generalization
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
