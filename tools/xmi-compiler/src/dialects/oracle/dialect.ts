/**
 * Oracle dialect mapper (Oracle 12.2+).
 */

import type { DialectConfig, DialectMapper, DialectTypeMapping } from '../../model/dialect/types.js'
import type { LogicalType, SchemaColumn } from '../../model/schema/types.js'
import { IdentifierShortener } from '../../identifiers/shortener.js'

const ORACLE_TYPE_MAP: Record<string, DialectTypeMapping> = {
  string:   { bounded: 'varchar2({length} char)', unbounded: 'clob' },
  integer:  { unbounded: 'number(10)' },
  long:     { unbounded: 'number(19)' },
  decimal:  { withPrecision: 'number({precision},{scale})' },
  boolean:  { unbounded: 'number(1)' },
  uuid:     { unbounded: 'varchar2(36 char)' },
  datetime: { unbounded: 'timestamp with time zone' },
  date:     { unbounded: 'date' },
  time:     { unbounded: 'varchar2(8 char)' },
  binary:   { unbounded: 'blob' },
  json:     { unbounded: 'clob' },
  enum:     { bounded: 'varchar2({length} char)', unbounded: 'varchar2(50 char)' },
}

const ORACLE_CONFIG: DialectConfig = {
  name: 'oracle',
  maxIdentifierLength: 128,
  typeMap: ORACLE_TYPE_MAP,
  quoteIdentifier: (id: string) => `"${id}"`,
  autoIncrementSyntax: 'GENERATED ALWAYS AS IDENTITY',
  uuidType: 'varchar2(36 char)',
}

/**
 * Oracle implementation of DialectMapper.
 */
export class OracleDialectMapper implements DialectMapper {
  readonly config: DialectConfig = ORACLE_CONFIG
  private readonly shortener: IdentifierShortener

  constructor() {
    this.shortener = new IdentifierShortener(ORACLE_CONFIG.maxIdentifierLength)
  }

  mapType(logicalType: LogicalType, column: SchemaColumn): string {
    const mapping = ORACLE_TYPE_MAP[logicalType]
    if (!mapping) return 'clob'

    if (column.precision !== undefined && column.scale !== undefined && mapping.withPrecision) {
      return mapping.withPrecision
        .replace('{precision}', String(column.precision))
        .replace('{scale}', String(column.scale))
    }
    if (column.length !== undefined && mapping.bounded) {
      return mapping.bounded.replace('{length}', String(column.length))
    }
    return mapping.unbounded ?? 'clob'
  }

  normalizeIdentifier(name: string): string {
    return this.shortener.shorten(name)
  }
}
