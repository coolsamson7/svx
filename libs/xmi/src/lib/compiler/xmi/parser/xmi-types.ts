/**
 * Raw XMI element types as produced by fast-xml-parser.
 * These are intentionally loose (`unknown` / `Record`) to accommodate
 * the wide variety of XMI documents in the wild.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Top-level XMI document wrapper */
export interface XmiDocument {
  'xmi:XMI': XmiRoot
}

/** Root XMI element */
export interface XmiRoot {
  'uml:Model': XmiModel
}

/** UML Model element */
export interface XmiModel {
  packagedElement?: XmiPackagedElement | XmiPackagedElement[]
}

/** A tagged value — key/value constraint attached to a DataType or class */
export interface XmiTaggedValue {
  '@_tag': string
  '@_value': string
}

/** Any packaged element (Class, Association, Enumeration, Package, …) */
export interface XmiPackagedElement {
  '@_xmi:type': string
  '@_xmi:id': string
  '@_name': string
  '@_visibility'?: string
  /** Sub-elements (nested packages, attributes, etc.) */
  packagedElement?: XmiPackagedElement | XmiPackagedElement[]
  /** Class attributes */
  ownedAttribute?: XmiOwnedAttribute | XmiOwnedAttribute[]
  /** Generalizations (inheritance) */
  generalization?: XmiGeneralization | XmiGeneralization[]
  /** Association ends */
  ownedEnd?: XmiOwnedEnd | XmiOwnedEnd[]
  /** Member ends (association end references) */
  memberEnd?: XmiMemberEnd | XmiMemberEnd[]
  /** Enumeration literals */
  ownedLiteral?: XmiOwnedLiteral | XmiOwnedLiteral[]
  /** Tagged values (DataType constraints, EA extensions) */
  taggedValue?: XmiTaggedValue | XmiTaggedValue[]
  /** isAbstract attribute */
  '@_isAbstract'?: string
  /** UML comment / description */
  ownedComment?: XmiOwnedComment | XmiOwnedComment[]
}

/** A class attribute (ownedAttribute) */
export interface XmiOwnedAttribute {
  '@_xmi:type': string
  '@_xmi:id': string
  '@_name': string
  '@_visibility'?: string
  '@_isUnique'?: string
  '@_isOrdered'?: string
  '@_isDerived'?: string
  '@_aggregation'?: string
  /** Inline type element */
  type?: XmiType
  /** Association reference if this is an association end */
  '@_association'?: string
  /** Lower multiplicity bound */
  lowerValue?: XmiMultiplicityValue
  /** Upper multiplicity bound */
  upperValue?: XmiMultiplicityValue
  /** Default value */
  defaultValue?: XmiDefaultValue
  /** Tagged values (Enterprise Architect extensions) */
  'xmi:Extension'?: any
  /** Tagged values on the attribute itself */
  taggedValue?: XmiTaggedValue | XmiTaggedValue[]
}

/** Type element inside an attribute */
export interface XmiType {
  '@_xmi:type'?: string
  '@_xmi:idref'?: string
  '@_href'?: string
  '@_name'?: string
}

/** Multiplicity value element */
export interface XmiMultiplicityValue {
  '@_xmi:type': string
  '@_xmi:id'?: string
  '@_value'?: string
}

/** Default value element */
export interface XmiDefaultValue {
  '@_xmi:type': string
  '@_xmi:id'?: string
  '@_value'?: string
  '@_instance'?: string
}

/** Generalization (extends) element */
export interface XmiGeneralization {
  '@_xmi:type': string
  '@_xmi:id': string
  '@_general': string
}

/** An association end inside a uml:Association */
export interface XmiOwnedEnd {
  '@_xmi:type': string
  '@_xmi:id': string
  '@_name'?: string
  '@_visibility'?: string
  '@_aggregation'?: string
  '@_type'?: string
  lowerValue?: XmiMultiplicityValue
  upperValue?: XmiMultiplicityValue
  type?: XmiType
}

/** A member end reference in a uml:Association */
export interface XmiMemberEnd {
  '@_xmi:idref'?: string
}

/** An enumeration literal */
export interface XmiOwnedLiteral {
  '@_xmi:type': string
  '@_xmi:id': string
  '@_name': string
}

/** A UML comment element (ownedComment) */
export interface XmiOwnedComment {
  body?: string
}
