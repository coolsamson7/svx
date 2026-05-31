/**
 * ORM model types — intermediate representation used by the TypeORM generator.
 * Built from ObjectModel + PersistenceModel before code generation.
 */

import type { RelationType } from '../object/types.js'

/** A single property to emit as a @Column or @PrimaryGeneratedColumn */
export interface OrmProperty {
  /** TypeScript property name */
  name: string
  /** TypeScript type string, e.g. "string", "number", "Date" */
  tsType: string
  /** Physical column name */
  columnName: string
  /** SQL type string for the @Column decorator */
  sqlType?: string
  /** Max length */
  length?: number
  /** Precision */
  precision?: number
  /** Scale */
  scale?: number
  /** Nullable */
  nullable: boolean
  /** Unique */
  unique: boolean
  /** Is this the primary key? */
  primaryKey: boolean
  /** Auto-generation strategy */
  generated?: 'uuid' | 'increment'
  /** Default value */
  defaultValue?: unknown
  /** Enum values (when type is an enum) */
  enumValues?: string[]
}

/** A single relation to emit as a @OneToMany / @ManyToOne etc. */
export interface OrmRelation {
  /** TypeScript property name */
  name: string
  /** Relation cardinality */
  relationType: RelationType
  /** Target entity class name */
  targetEntity: string
  /** Property on target that maps back */
  mappedBy?: string
  /** FK column name (owning side of ManyToOne / OneToOne) */
  joinColumnName?: string
  /** Join table info (ManyToMany owning side) */
  joinTable?: {
    name: string
    joinColumn: string
    inverseJoinColumn: string
  }
  /** Whether this side is the owning side */
  isOwning: boolean
  /** Whether the relation is a collection on this side */
  isCollection: boolean
  /** Cascade operations */
  cascade?: string[]
}

/** A complete ORM entity to generate */
export interface OrmEntity {
  /** Class name */
  className: string
  /** Physical table name */
  tableName: string
  /** All scalar/enum properties */
  properties: OrmProperty[]
  /** All relation properties */
  relations: OrmRelation[]
}
