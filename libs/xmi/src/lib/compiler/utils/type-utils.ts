/**
 * Utility functions for working with type mappings and type conversions.
 */

import type { PrimitiveType } from '../model/object/types.js'
import type { LogicalType } from '../model/schema/types.js'

/** Map from primitive type names to TypeScript type strings */
const PRIMITIVE_TO_TS: Record<PrimitiveType, string> = {
  string: 'string',
  integer: 'number',
  long: 'number',
  decimal: 'number',
  boolean: 'boolean',
  uuid: 'string',
  datetime: 'Date',
  date: 'Date',
  time: 'string',
  binary: 'Buffer',
  json: 'Record<string, unknown>',
}

/**
 * Convert a primitive type name to its TypeScript equivalent.
 * Returns `string` as the fallback for unknown types (e.g. enum names).
 */
export function primitiveToTs(type: string): string {
  return PRIMITIVE_TO_TS[type as PrimitiveType] ?? 'string'
}

/** All valid primitive type names */
const PRIMITIVE_TYPES = new Set<string>([
  'string', 'integer', 'long', 'decimal', 'boolean',
  'uuid', 'datetime', 'date', 'time', 'binary', 'json',
])

/** Return true if the given type name is a known primitive */
export function isPrimitive(type: string): type is PrimitiveType {
  return PRIMITIVE_TYPES.has(type)
}

/**
 * Convert a primitive type name to the logical schema type.
 * For non-primitive names (enum references etc.) returns 'string'.
 */
export function primitiveToLogical(type: string): LogicalType {
  if (isPrimitive(type)) return type as LogicalType
  return 'string'
}

/**
 * Map a logical type to a TypeORM column type string.
 */
export function logicalToTypeOrmType(logicalType: LogicalType): string {
  const map: Record<LogicalType, string> = {
    string: 'varchar',
    integer: 'int',
    long: 'bigint',
    decimal: 'decimal',
    boolean: 'boolean',
    uuid: 'uuid',
    datetime: 'timestamptz',
    date: 'date',
    time: 'time',
    binary: 'bytea',
    json: 'jsonb',
    enum: 'varchar',
  }
  return map[logicalType]
}
