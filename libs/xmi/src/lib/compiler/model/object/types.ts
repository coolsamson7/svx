/**
 * Object Model types — the canonical in-memory representation of a UML class diagram.
 * This is the first intermediate representation produced by the XMI parser.
 */

/** All primitive types supported in the object model */
export type PrimitiveType =
  | 'string'
  | 'integer'
  | 'long'
  | 'decimal'
  | 'boolean'
  | 'uuid'
  | 'datetime'
  | 'date'
  | 'time'
  | 'binary'
  | 'json'

/** All relation cardinalities */
export type RelationType =
  | 'one_to_one'
  | 'one_to_many'
  | 'many_to_one'
  | 'many_to_many'

/**
 * A single property (attribute) on an ObjectType.
 * `type` can be a PrimitiveType name, an enum name, or another type name (for embedded).
 */
export interface Property {
  /** Property name as it appears in the model */
  name: string
  /** Primitive type name, enum name, or referenced type name */
  type: PrimitiveType | string
  /** True if the type references an enum */
  isEnum?: boolean
  /** True if this is a collection property */
  isCollection?: boolean
  /** True if the value can be null */
  isNullable?: boolean
  /** Maximum character length (for string types) */
  length?: number
  /** Total number of digits (for decimal types) */
  precision?: number
  /** Number of decimal digits (for decimal types) */
  scale?: number
  /** Default value for the property */
  defaultValue?: unknown
  /** Human-readable description from ownedComment */
  description?: string
  /** Raw tagged values from the XMI attribute (e.g. primary-key, generated, max-length) */
  tags?: Record<string, string>
}

/** A UML association end as seen from one ObjectType */
export interface Relation {
  /** Property name on the owning type */
  name: string
  /** Cardinality of the relation */
  type: RelationType
  /** Target type name */
  target: string
  /** Field name on the target that maps back to this type (for bidirectional) */
  mappedBy?: string
  /** True if this side holds the foreign key or join table */
  isOwning: boolean
}

/** A UML class mapped to an in-memory object type */
export interface ObjectType {
  name: string
  superType?: string
  isAbstract?: boolean
  properties: Property[]
  relations: Relation[]
  /** Package path from uml:Package nesting — used for output directory structure */
  packagePath: string[]
  /** Human-readable description from ownedComment */
  description?: string
}

/** A UML enumeration */
export interface EnumType {
  /** Enum name */
  name: string
  /** All literal values */
  values: string[]
  /** Human-readable description from ownedComment */
  description?: string
}

/**
 * A named primitive subtype declared as uml:DataType in the XMI.
 * Emitted as a shared constant in entity-schemas.ts.
 * Example: SmallString (baseType: 'string', tags: { maxLength: '100' })
 *   → export const SmallString = string().max(100)
 */
export interface DataType {
  name: string
  baseType: PrimitiveType
  tags: Record<string, string>
  packagePath: string[]
  /** Human-readable description from ownedComment */
  description?: string
}

/** The complete object model derived from a single XMI document */
export interface ObjectModel {
  /** All class types (including abstract ones) */
  types: ObjectType[]
  /** All enumeration types */
  enums: EnumType[]
  /** Named primitive subtypes (uml:DataType elements with a generalization) */
  dataTypes: DataType[]
}
