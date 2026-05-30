/**
 * Oracle DDL generator.
 */

import type { AbstractSchema, SchemaTable } from '../../../model/schema/types.js'
import type { DialectMapper } from '../../../model/dialect/types.js'
import { BaseSqlGenerator } from '../base-sql-generator.js'

export class OracleSqlGenerator extends BaseSqlGenerator {
  generateCreateTable(table: SchemaTable, dialect: DialectMapper): string {
    const q = dialect.config.quoteIdentifier
    const lines: string[] = []
    lines.push(`CREATE TABLE ${q(table.physicalName)} (`)

    const colDefs = table.columns.map(col => {
      if (col.primaryKey && col.generated === 'uuid') {
        return `  ${q(col.physicalName)} ${dialect.config.uuidType} DEFAULT sys_guid() NOT NULL`
      }
      if (col.primaryKey && col.generated === 'increment') {
        return `  ${q(col.physicalName)} NUMBER(10) ${dialect.config.autoIncrementSyntax} NOT NULL`
      }
      return this.columnDef(col, dialect)
    })

    if (table.primaryKey.length > 0) {
      colDefs.push(this.primaryKeyDef(table.primaryKey, dialect))
    }

    lines.push(colDefs.join(',\n'))
    lines.push(');')
    return lines.join('\n')
  }

  generateForeignKeys(schema: AbstractSchema, dialect: DialectMapper): string[] {
    const stmts: string[] = []
    for (const table of Object.values(schema.tables)) {
      for (const fk of table.foreignKeys) {
        stmts.push(this.foreignKeyDef(table.physicalName, fk, dialect))
      }
    }
    for (const jt of schema.joinTables) {
      for (const fk of jt.foreignKeys) {
        stmts.push(this.foreignKeyDef(jt.physicalName, fk, dialect))
      }
    }
    return stmts
  }
}
