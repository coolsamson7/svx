/**
 * Abstract Schema types — a dialect-agnostic representation of the relational schema.
 * Physical names start identical to logical names and are adjusted by the dialect transformer.
 */

/** All logical column types understood by the schema layer */
export type LogicalType =
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
  | 'enum'

/**
 * A single column in an abstract schema table.
 */
export interface SchemaColumn {
  /** Column name in the object model */
  logicalName: string
  /** Column name after dialect normalisation (starts equal to logicalName) */
  physicalName: string
  /** Logical type */
  logicalType: LogicalType
  /** Max character length (string/enum) */
  length?: number
  /** Total digit count (decimal) */
  precision?: number
  /** Fractional digit count (decimal) */
  scale?: number
  /** Whether the column is nullable */
  nullable: boolean
  /** Whether the column has a UNIQUE constraint */
  unique: boolean
  /** Whether this column is part of the primary key */
  primaryKey: boolean
  /** Default value */
  defaultValue?: unknown
  /** Enum literal values (when logicalType === 'enum') */
  enumValues?: string[]
  /** Auto-generation strategy */
  generated?: 'uuid' | 'increment'
  /** Explicit SQL type override — bypasses logical→dialect mapping */
  sqlTypeOverride?: string
}

/**
 * A foreign key constraint.
 */
export interface ForeignKey {
  /** Logical constraint name */
  logicalName: string
  /** Physical constraint name after dialect normalisation */
  physicalName: string
  /** Local column(s) that hold the FK value */
  columns: string[]
  /** Referenced table name */
  referencedTable: string
  /** Referenced column(s) in the target table */
  referencedColumns: string[]
}

/**
 * A join table for a many-to-many relation.
 */
export interface JoinTableSchema {
  /** Logical table name */
  logicalName: string
  /** Physical table name after dialect normalisation */
  physicalName: string
  /** The two FK columns */
  columns: SchemaColumn[]
  /** Composite primary key column names (both FK columns) */
  primaryKey: string[]
  /** The two foreign key constraints */
  foreignKeys: ForeignKey[]
}

/**
 * A regular entity table.
 */
export interface SchemaTable {
  /** Logical table name */
  logicalName: string
  /** Physical table name after dialect normalisation */
  physicalName: string
  /** All columns */
  columns: SchemaColumn[]
  /** Primary key column names */
  primaryKey: string[]
  /** All foreign key constraints */
  foreignKeys: ForeignKey[]
}

/**
 * The complete abstract schema produced before dialect-specific rendering.
 */
export interface AbstractSchema {
  /** Entity tables keyed by logical name */
  tables: Record<string, SchemaTable>
  /** Many-to-many join tables */
  joinTables: JoinTableSchema[]
}
