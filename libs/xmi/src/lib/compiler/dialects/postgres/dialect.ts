/**
 * PostgreSQL dialect mapper.
 */

import type { DialectConfig, DialectMapper, DialectTypeMapping } from '../../model/dialect/types.js'
import type { LogicalType, SchemaColumn } from '../../model/schema/types.js'
import { IdentifierShortener } from '../../identifiers/shortener.js'

const POSTGRES_TYPE_MAP: Record<string, DialectTypeMapping> = {
  string:   { bounded: 'varchar({length})', unbounded: 'text' },
  integer:  { unbounded: 'integer' },
  long:     { unbounded: 'bigint' },
  decimal:  { withPrecision: 'numeric({precision},{scale})' },
  boolean:  { unbounded: 'boolean' },
  uuid:     { unbounded: 'uuid' },
  datetime: { unbounded: 'timestamptz' },
  date:     { unbounded: 'date' },
  time:     { unbounded: 'time' },
  binary:   { unbounded: 'bytea' },
  json:     { unbounded: 'jsonb' },
  enum:     { bounded: 'varchar({length})', unbounded: 'varchar(50)' },
}

const POSTGRES_CONFIG: DialectConfig = {
  name: 'postgresql',
  maxIdentifierLength: 63,
  typeMap: POSTGRES_TYPE_MAP,
  quoteIdentifier: (id: string) => `"${id}"`,
  autoIncrementSyntax: 'GENERATED ALWAYS AS IDENTITY',
  uuidType: 'uuid',
}

/**
 * PostgreSQL implementation of DialectMapper.
 */
export class PostgresDialectMapper implements DialectMapper {
  readonly config: DialectConfig = POSTGRES_CONFIG
  private readonly shortener: IdentifierShortener

  constructor() {
    this.shortener = new IdentifierShortener(POSTGRES_CONFIG.maxIdentifierLength)
  }

  mapType(logicalType: LogicalType, column: SchemaColumn): string {
    const mapping = POSTGRES_TYPE_MAP[logicalType]
    if (!mapping) return 'text'

    if (column.precision !== undefined && column.scale !== undefined && mapping.withPrecision) {
      return mapping.withPrecision
        .replace('{precision}', String(column.precision))
        .replace('{scale}', String(column.scale))
    }
    if (column.length !== undefined && mapping.bounded) {
      return mapping.bounded.replace('{length}', String(column.length))
    }
    return mapping.unbounded ?? 'text'
  }

  normalizeIdentifier(name: string): string {
    return this.shortener.shorten(name)
  }
}
