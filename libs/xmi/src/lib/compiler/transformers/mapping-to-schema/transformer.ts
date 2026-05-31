/**
 * PersistenceModel → AbstractSchema transformer.
 * Converts typed mappings into physical table/column/FK structures.
 */

import type { PersistenceModel, TypeMapping, FieldMapping, RelationMapping } from '../../model/mapping/types.js'
import type {
  AbstractSchema, SchemaTable, SchemaColumn, ForeignKey, JoinTableSchema,
} from '../../model/schema/types.js'
import type { LogicalType } from '../../model/schema/types.js'
import type { NamingStrategy } from '../../naming/strategy.js'

/**
 * Transforms a PersistenceModel into an AbstractSchema.
 * Logical and physical names are identical at this stage; the dialect transformer
 * will adjust physical names later.
 */
export class MappingToSchemaTransformer {
  private readonly naming: NamingStrategy

  constructor(naming: NamingStrategy) {
    this.naming = naming
  }

  transform(model: PersistenceModel): AbstractSchema {
    const tables: Record<string, SchemaTable> = {}
    const joinTables: JoinTableSchema[] = []

    for (const [typeName, typeMapping] of Object.entries(model.mappings)) {
      const table = this.buildTable(typeName, typeMapping, model)

      if (tables[typeMapping.table]) {
        // SINGLE_TABLE: multiple mappings share a physical table — merge columns/FKs
        const existing = tables[typeMapping.table]
        for (const col of table.columns) {
          if (!existing.columns.some(c => c.logicalName === col.logicalName)) {
            existing.columns.push(col)
          }
        }
        for (const fk of table.foreignKeys) {
          if (!existing.foreignKeys.some(f => f.logicalName === fk.logicalName)) {
            existing.foreignKeys.push(fk)
          }
        }
      } else {
        tables[typeMapping.table] = table
      }

      // Build join tables for ManyToMany owning sides
      for (const rel of typeMapping.relations) {
        if (rel.relationType === 'many_to_many' && rel.joinTable) {
          const jt = this.buildJoinTable(rel, typeMapping, model)
          const alreadyExists = joinTables.some(j => j.logicalName === jt.logicalName)
          if (!alreadyExists) {
            joinTables.push(jt)
          }
        }
      }
    }

    return { tables, joinTables }
  }

  private buildTable(
    _typeName: string,
    typeMapping: TypeMapping,
    model: PersistenceModel,
  ): SchemaTable {
    const tableName = typeMapping.table
    const columns: SchemaColumn[] = []
    const foreignKeys: ForeignKey[] = []
    const primaryKey: string[] = []

    // Columns from field mappings
    for (const field of typeMapping.fields) {
      const col = this.fieldToColumn(field)
      columns.push(col)
      if (col.primaryKey) primaryKey.push(col.physicalName)
    }

    // FK columns from ManyToOne / OneToOne owning relations
    for (const rel of typeMapping.relations) {
      if (
        (rel.relationType === 'many_to_one' || rel.relationType === 'one_to_one') &&
        rel.joinColumn
      ) {
        // Add FK column
        const fkCol: SchemaColumn = {
          logicalName: rel.joinColumn,
          physicalName: rel.joinColumn,
          logicalType: 'uuid',
          nullable: true,
          unique: rel.relationType === 'one_to_one',
          primaryKey: false,
        }
        // Avoid duplicate columns
        if (!columns.some(c => c.logicalName === fkCol.logicalName)) {
          columns.push(fkCol)
        }

        // Add FK constraint
        const targetMapping = Object.values(model.mappings).find(m => m.typeName === rel.target)
        if (targetMapping) {
          const fkName = this.naming.foreignKeyName(
            tableName,
            targetMapping.table,
            rel.joinColumn,
          )
          const fk: ForeignKey = {
            logicalName: fkName,
            physicalName: fkName,
            columns: [rel.joinColumn],
            referencedTable: targetMapping.table,
            referencedColumns: ['ID'], // standard PK name
          }
          foreignKeys.push(fk)
        }
      }
    }

    // JOINED: add FK from PK to the parent abstract type's table
    if (typeMapping.joinedParent) {
      const parentMapping = Object.values(model.mappings).find(m => m.typeName === typeMapping.joinedParent)
      if (parentMapping) {
        const pkCol = 'ID'
        const fkName = this.naming.foreignKeyName(tableName, parentMapping.table, pkCol)
        foreignKeys.push({
          logicalName: fkName,
          physicalName: fkName,
          columns: [pkCol],
          referencedTable: parentMapping.table,
          referencedColumns: [pkCol],
        })
      }
    }

    return {
      logicalName: tableName,
      physicalName: tableName,
      columns,
      primaryKey,
      foreignKeys,
    }
  }

  private fieldToColumn(field: FieldMapping): SchemaColumn {
    return {
      logicalName: field.column,
      physicalName: field.column,
      logicalType: field.logicalType as LogicalType,
      length: field.length,
      precision: field.precision,
      scale: field.scale,
      nullable: field.nullable ?? true,
      unique: field.unique ?? false,
      primaryKey: field.primaryKey ?? false,
      defaultValue: field.defaultValue,
      generated: field.generated,
    }
  }

  private buildJoinTable(
    rel: RelationMapping,
    ownerMapping: TypeMapping,
    model: PersistenceModel,
  ): JoinTableSchema {
    const jt = rel.joinTable!
    const joinTableName = jt.name

    const ownerFkCol: SchemaColumn = {
      logicalName: jt.joinColumn,
      physicalName: jt.joinColumn,
      logicalType: 'uuid',
      nullable: false,
      unique: false,
      primaryKey: true,
    }
    const inverseFkCol: SchemaColumn = {
      logicalName: jt.inverseJoinColumn,
      physicalName: jt.inverseJoinColumn,
      logicalType: 'uuid',
      nullable: false,
      unique: false,
      primaryKey: true,
    }

    // FK to owner table
    const ownerFkName = this.naming.foreignKeyName(joinTableName, ownerMapping.table, jt.joinColumn)
    const ownerFk: ForeignKey = {
      logicalName: ownerFkName,
      physicalName: ownerFkName,
      columns: [jt.joinColumn],
      referencedTable: ownerMapping.table,
      referencedColumns: ['ID'],
    }

    // FK to target table
    const targetMapping = Object.values(model.mappings).find(m => m.typeName === rel.target)
    const targetTable = targetMapping?.table ?? rel.target
    const inverseFkName = this.naming.foreignKeyName(joinTableName, targetTable, jt.inverseJoinColumn)
    const inverseFk: ForeignKey = {
      logicalName: inverseFkName,
      physicalName: inverseFkName,
      columns: [jt.inverseJoinColumn],
      referencedTable: targetTable,
      referencedColumns: ['ID'],
    }

    return {
      logicalName: joinTableName,
      physicalName: joinTableName,
      columns: [ownerFkCol, inverseFkCol],
      primaryKey: [jt.joinColumn, jt.inverseJoinColumn],
      foreignKeys: [ownerFk, inverseFk],
    }
  }
}
