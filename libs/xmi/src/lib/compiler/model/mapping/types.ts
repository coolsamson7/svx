/**
 * Persistence Mapping types — describe HOW an ObjectModel is mapped to relational tables.
 * Consumed by the mapping-to-schema transformer to produce AbstractSchema.
 */

import type { RelationType } from '../object/types.js'

/** Inheritance mapping strategies (JPA-style) */
export type InheritanceStrategy = 'SINGLE_TABLE' | 'JOINED' | 'TABLE_PER_CLASS'

/**
 * Maps a single property to a database column.
 */
export interface FieldMapping {
  /** Original property name in the ObjectType */
  property: string
  /** Physical column name */
  column: string
  /** Logical type name (from PrimitiveType or 'enum') — always the base primitive */
  logicalType: string
  /** Named DataType (uml:DataType) if the property references one — used by schema generator */
  dataTypeName?: string
  /** Max length for string columns */
  length?: number
  /** Precision for decimal columns */
  precision?: number
  /** Scale for decimal columns */
  scale?: number
  /** Whether the column is nullable */
  nullable?: boolean
  /** Whether the column has a unique constraint */
  unique?: boolean
  /** Whether this column is part of the primary key */
  primaryKey?: boolean
  /** Auto-generation strategy for the primary key */
  generated?: 'uuid' | 'increment'
  /** Default value expression */
  defaultValue?: unknown
}

/**
 * Describes the join table used by a many-to-many relation.
 */
export interface JoinTableMapping {
  /** Physical table name */
  name: string
  /** Column referencing the owning entity's PK */
  joinColumn: string
  /** Column referencing the inverse entity's PK */
  inverseJoinColumn: string
}

/**
 * Maps a single relation to its database representation.
 */
export interface RelationMapping {
  /** Property name on the owning side */
  property: string
  /** Cardinality */
  relationType: RelationType
  /** Target type name */
  target: string
  /** Field on the target that maps back (bidirectional) */
  mappedBy?: string
  /** FK column name (for ManyToOne / OneToOne owning side) */
  joinColumn?: string
  /** Join table definition (for ManyToMany owning side) */
  joinTable?: JoinTableMapping
  /** Whether this is the owning side of the relation */
  isOwning?: boolean
  /** Cascade operations */
  cascade?: string[]
}

/**
 * Full persistence mapping for a single ObjectType.
 */
export interface TypeMapping {
  /** Class / type name (same as ObjectType.name) */
  typeName: string
  /** Physical table name */
  table: string
  /** Column mappings for all scalar properties */
  fields: FieldMapping[]
  /** Relation mappings */
  relations: RelationMapping[]
  /** Inheritance strategy (if this is part of an inheritance hierarchy) */
  inheritanceStrategy?: InheritanceStrategy
  /** Discriminator column name (SINGLE_TABLE) */
  discriminatorColumn?: string
  /** Discriminator value for this specific type */
  discriminatorValue?: string
  /** For JOINED: the abstract parent type name whose table this type's PK references */
  joinedParent?: string
}

/**
 * The complete persistence model — one TypeMapping per ObjectType.
 */
export interface PersistenceModel {
  /** Keyed by type name */
  mappings: Record<string, TypeMapping>
}
