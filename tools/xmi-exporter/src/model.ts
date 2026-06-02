export type Multiplicity = '0..1' | '1' | '0..*' | '1..*';

export interface TaggedValue {
  tag: string;
  value: string;
}

export interface UmlModel {
  classes: UmlClass[];
  dataTypes: UmlDataType[];
  associations: UmlAssociation[];
}

export interface UmlClass {
  id: string;
  name: string;
  attributes: UmlAttribute[];
  taggedValues: TaggedValue[];
}

export interface UmlDataType {
  id: string;
  name: string;
  baseType?: string;   // UML primitive this type restricts, e.g. "String"
  taggedValues: TaggedValue[];
}

export interface UmlAttribute {
  id: string;
  name: string;
  typeRef: string;   // UML primitive name OR id of a class/datatype
  isRef: boolean;    // true when typeRef is an id (not a primitive name)
  taggedValues: TaggedValue[];
}

export interface UmlAssociation {
  id: string;
  sourceId: string;
  targetId: string;
  sourceRole: string;
  targetRole: string;
  sourceMult: Multiplicity;
  targetMult: Multiplicity;
  taggedValues: TaggedValue[];
  /** ORM cascade value on the source end (e.g. 'true', 'insert,update') */
  sourceCascade?: string;
  /** DB-level ON DELETE action on the source end */
  sourceOnDelete?: string;
  /** ORM cascade value on the target end */
  targetCascade?: string;
  /** DB-level ON DELETE action on the target end */
  targetOnDelete?: string;
}
