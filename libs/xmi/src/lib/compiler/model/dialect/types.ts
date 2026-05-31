/**
 * Dialect types — describe how a specific database engine maps logical types and identifiers.
 */

import type { LogicalType, SchemaColumn } from '../schema/types.js'

/**
 * How a logical type maps to a SQL type string in a specific dialect.
 * Template variables: `{length}`, `{precision}`, `{scale}`.
 */
export interface DialectTypeMapping {
  /** SQL type used when no length/precision is specified, e.g. `"text"` */
  unbounded?: string
  /** SQL type template when a length is specified, e.g. `"varchar({length})"` */
  bounded?: string
  /** SQL type template when precision/scale are specified, e.g. `"decimal({precision},{scale})"` */
  withPrecision?: string
}

/**
 * Static configuration for a database dialect.
 */
export interface DialectConfig {
  /** Human-readable dialect name */
  name: string
  /** Maximum identifier length supported by the database */
  maxIdentifierLength: number
  /** Mapping from logical type to SQL type templates */
  typeMap: Record<string, DialectTypeMapping>
  /** Function that quotes an identifier according to dialect rules */
  quoteIdentifier: (id: string) => string
  /** DDL fragment for auto-increment / identity columns */
  autoIncrementSyntax: string
  /** SQL type used for UUID primary keys */
  uuidType: string
}

/**
 * A dialect mapper resolves logical schema information to dialect-specific strings.
 */
export interface DialectMapper {
  /** Underlying configuration */
  readonly config: DialectConfig
  /**
   * Map a logical column type to a concrete SQL type string.
   * Uses length/precision/scale from the column if present.
   */
  mapType(logicalType: LogicalType, column: SchemaColumn): string
  /**
   * Normalise an identifier: enforce case rules, shorten if necessary.
   */
  normalizeIdentifier(name: string): string
}
