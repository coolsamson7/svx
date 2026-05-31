/**
 * Base SQL DDL generator — provides the common generate() orchestration.
 * Dialect subclasses implement the actual SQL syntax.
 */

import type { AbstractSchema, SchemaTable, SchemaColumn, ForeignKey } from '../../model/schema/types.js'
import type { DialectMapper } from '../../model/dialect/types.js'

/**
 * Abstract base for SQL DDL generators.
 * Subclasses provide dialect-specific CREATE TABLE and FK syntax.
 */
export abstract class BaseSqlGenerator {
  /** Generate a CREATE TABLE statement for one table */
  abstract generateCreateTable(table: SchemaTable, dialect: DialectMapper): string

  /** Generate ALTER TABLE ADD CONSTRAINT for all FK constraints */
  abstract generateForeignKeys(schema: AbstractSchema, dialect: DialectMapper): string[]

  /**
   * Generate the full DDL for the schema:
   * 1. DROP TABLE IF EXISTS (reverse order)
   * 2. CREATE TABLE for each entity table
   * 3. CREATE TABLE for each join table
   * 4. ALTER TABLE ADD CONSTRAINT for each FK
   */
  generate(schema: AbstractSchema, dialect: DialectMapper, options?: { emitForeignKeys?: boolean }): string {
    const lines: string[] = []
    const q = dialect.config.quoteIdentifier

    // Drop statements (reverse order to handle FK deps)
    const allTables = [
      ...Object.values(schema.tables).map(t => t.physicalName),
      ...schema.joinTables.map(t => t.physicalName),
    ]
    for (const t of [...allTables].reverse()) {
      lines.push(`DROP TABLE IF EXISTS ${q(t)};`)
    }
    lines.push('')

    // Entity tables
    for (const table of Object.values(schema.tables)) {
      lines.push(this.generateCreateTable(table, dialect))
      lines.push('')
    }

    // Join tables
    for (const jt of schema.joinTables) {
      lines.push(this.generateJoinTable(jt as unknown as SchemaTable, dialect))
      lines.push('')
    }

    // Foreign keys
    if (options?.emitForeignKeys !== false) {
      const fks = this.generateForeignKeys(schema, dialect)
      if (fks.length > 0) {
        lines.push(...fks)
        lines.push('')
      }
    }

    return lines.join('\n')
  }

  /**
   * Build a JOIN TABLE CREATE TABLE statement.
   * Default implementation delegates to generateCreateTable.
   */
  protected generateJoinTable(table: SchemaTable, dialect: DialectMapper): string {
    return this.generateCreateTable(table, dialect)
  }

  /** Build a single column definition line */
  protected columnDef(col: SchemaColumn, dialect: DialectMapper): string {
    const q = dialect.config.quoteIdentifier
    const sqlType = col.sqlTypeOverride ?? dialect.mapType(col.logicalType, col)
    const nullability = col.nullable ? 'NULL' : 'NOT NULL'
    const unique = col.unique && !col.primaryKey ? ' UNIQUE' : ''
    const defaultClause = col.defaultValue !== undefined
      ? ` DEFAULT ${this.formatDefault(col.defaultValue)}`
      : ''
    return `  ${q(col.physicalName)} ${sqlType} ${nullability}${unique}${defaultClause}`
  }

  /** Format a default value for SQL */
  protected formatDefault(value: unknown): string {
    if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`
    return String(value)
  }

  /** Build a PRIMARY KEY constraint line */
  protected primaryKeyDef(pk: string[], dialect: DialectMapper): string {
    const q = dialect.config.quoteIdentifier
    const cols = pk.map(q).join(', ')
    return `  PRIMARY KEY (${cols})`
  }

  /** Build a single ALTER TABLE … ADD CONSTRAINT FK statement */
  protected foreignKeyDef(
    tableName: string,
    fk: ForeignKey,
    dialect: DialectMapper,
  ): string {
    const q = dialect.config.quoteIdentifier
    const cols = fk.columns.map(q).join(', ')
    const refCols = fk.referencedColumns.map(q).join(', ')
    return (
      `ALTER TABLE ${q(tableName)}\n` +
      `  ADD CONSTRAINT ${q(fk.physicalName)}\n` +
      `  FOREIGN KEY (${cols})\n` +
      `  REFERENCES ${q(fk.referencedTable)} (${refCols});`
    )
  }
}
