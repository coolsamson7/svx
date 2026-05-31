/**
 * AbstractSchema → dialect-specific AbstractSchema transformer.
 * Applies physical identifier rules and type resolution for the target dialect.
 */

import type { AbstractSchema, SchemaTable, SchemaColumn, ForeignKey, JoinTableSchema } from '../../model/schema/types.js'
import type { DialectMapper } from '../../model/dialect/types.js'

/**
 * Applies dialect-specific normalisation to an AbstractSchema.
 * Physical names are shortened and cased; column types are resolved.
 */
export class SchemaToDialectTransformer {
  transform(schema: AbstractSchema, dialect: DialectMapper): AbstractSchema {
    const tables: Record<string, SchemaTable> = {}
    const joinTables: JoinTableSchema[] = []

    for (const [key, table] of Object.entries(schema.tables)) {
      tables[key] = this.transformTable(table, dialect)
    }

    for (const jt of schema.joinTables) {
      joinTables.push(this.transformJoinTable(jt, dialect))
    }

    return { tables, joinTables }
  }

  private transformTable(table: SchemaTable, dialect: DialectMapper): SchemaTable {
    const physicalName = dialect.normalizeIdentifier(table.logicalName)
    const columns = table.columns.map(col => this.transformColumn(col, dialect))
    const foreignKeys = table.foreignKeys.map(fk => this.transformFk(fk, dialect))
    const primaryKey = table.primaryKey.map(pk => dialect.normalizeIdentifier(pk))

    return {
      logicalName: table.logicalName,
      physicalName,
      columns,
      primaryKey,
      foreignKeys,
    }
  }

  private transformColumn(col: SchemaColumn, dialect: DialectMapper): SchemaColumn {
    const physicalName = dialect.normalizeIdentifier(col.logicalName)
    return {
      ...col,
      physicalName,
      // Resolve the SQL type but store it in the logicalType field for DDL generation
      // The actual SQL type string is derived at DDL generation time via mapType
    }
  }

  private transformFk(fk: ForeignKey, dialect: DialectMapper): ForeignKey {
    const physicalName = dialect.normalizeIdentifier(fk.logicalName)
    const columns = fk.columns.map(c => dialect.normalizeIdentifier(c))
    const referencedTable = dialect.normalizeIdentifier(fk.referencedTable)
    const referencedColumns = fk.referencedColumns.map(c => dialect.normalizeIdentifier(c))

    return {
      logicalName: fk.logicalName,
      physicalName,
      columns,
      referencedTable,
      referencedColumns,
    }
  }

  private transformJoinTable(jt: JoinTableSchema, dialect: DialectMapper): JoinTableSchema {
    const physicalName = dialect.normalizeIdentifier(jt.logicalName)
    const columns = jt.columns.map(col => this.transformColumn(col, dialect))
    const foreignKeys = jt.foreignKeys.map(fk => this.transformFk(fk, dialect))
    const primaryKey = jt.primaryKey.map(pk => dialect.normalizeIdentifier(pk))

    return {
      logicalName: jt.logicalName,
      physicalName,
      columns,
      primaryKey,
      foreignKeys,
    }
  }
}
