/**
 * MySQL dialect mapper.
 */

import type { DialectConfig, DialectMapper, DialectTypeMapping } from '../../model/dialect/types.js'
import type { LogicalType, SchemaColumn } from '../../model/schema/types.js'
import { IdentifierShortener } from '../../identifiers/shortener.js'

const MYSQL_TYPE_MAP: Record<string, DialectTypeMapping> = {
  string:   { bounded: 'varchar({length})', unbounded: 'text' },
  integer:  { unbounded: 'int' },
  long:     { unbounded: 'bigint' },
  decimal:  { withPrecision: 'decimal({precision},{scale})' },
  boolean:  { unbounded: 'tinyint(1)' },
  uuid:     { unbounded: 'char(36)' },
  datetime: { unbounded: 'datetime' },
  date:     { unbounded: 'date' },
  time:     { unbounded: 'time' },
  binary:   { unbounded: 'blob' },
  json:     { unbounded: 'json' },
  enum:     { bounded: 'varchar({length})', unbounded: 'varchar(50)' },
}

const MYSQL_CONFIG: DialectConfig = {
  name: 'mysql',
  maxIdentifierLength: 64,
  typeMap: MYSQL_TYPE_MAP,
  quoteIdentifier: (id: string) => `\`${id}\``,
  autoIncrementSyntax: 'AUTO_INCREMENT',
  uuidType: 'char(36)',
}

/**
 * MySQL implementation of DialectMapper.
 */
export class MySqlDialectMapper implements DialectMapper {
  readonly config: DialectConfig = MYSQL_CONFIG
  private readonly shortener: IdentifierShortener

  constructor() {
    this.shortener = new IdentifierShortener(MYSQL_CONFIG.maxIdentifierLength)
  }

  mapType(logicalType: LogicalType, column: SchemaColumn): string {
    const mapping = MYSQL_TYPE_MAP[logicalType]
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
