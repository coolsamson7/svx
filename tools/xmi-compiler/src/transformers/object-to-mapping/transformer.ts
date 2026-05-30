/**
 * ObjectModel → PersistenceModel transformer.
 * Applies naming strategy and produces full persistence mappings.
 */

import type { ObjectModel, ObjectType, Property, Relation } from '../../model/object/types.js'
import type {
  PersistenceModel, TypeMapping, FieldMapping, RelationMapping, JoinTableMapping,
} from '../../model/mapping/types.js'
import type { NamingStrategy } from '../../naming/strategy.js'
import { primitiveToLogical, isPrimitive } from '../../utils/type-utils.js'

/**
 * Transforms an ObjectModel into a PersistenceModel using the given naming strategy.
 */
export class ObjectToMappingTransformer {
  private readonly naming: NamingStrategy

  constructor(naming: NamingStrategy) {
    this.naming = naming
  }

  transform(model: ObjectModel): PersistenceModel {
    const mappings: Record<string, TypeMapping> = {}
    const enumNames = new Set(model.enums.map(e => e.name))
    const dataTypeNames = new Set(model.dataTypes.map(d => d.name))
    const dataTypeByName = new Map(model.dataTypes.map(d => [d.name, d]))

    for (const type of model.types) {
      if (type.isAbstract) continue // skip abstract types

      const tableName = this.naming.tableName(type.name)

      // Fields
      const fields: FieldMapping[] = []

      // Auto-generate id if no primary key property exists
      const hasId = type.properties.some(p => p.name === 'id')
      if (!hasId) {
        fields.push({
          property: 'id',
          column: this.naming.columnName('id'),
          logicalType: 'uuid',
          nullable: false,
          unique: true,
          primaryKey: true,
          generated: 'uuid',
        })
      }

      for (const prop of type.properties) {
        fields.push(this.mapProperty(prop, tableName, enumNames, dataTypeNames, dataTypeByName))
      }

      // Relations
      const relations: RelationMapping[] = []
      for (const rel of type.relations) {
        relations.push(this.mapRelation(rel, tableName, model))
      }

      mappings[type.name] = {
        typeName: type.name,
        table: tableName,
        fields,
        relations,
      }
    }

    return { mappings }
  }

  private mapProperty(
    prop: Property,
    _tableName: string,
    enumNames: Set<string>,
    dataTypeNames: Set<string>,
    dataTypeByName: Map<string, { baseType: string; tags: Record<string, string> }>,
  ): FieldMapping {
    const columnName = this.naming.columnName(prop.name)
    const isEnum = prop.isEnum || enumNames.has(prop.type as string)
    const isDataType = !isEnum && dataTypeNames.has(prop.type as string)
    const dt = isDataType ? dataTypeByName.get(prop.type as string) : undefined
    const logicalType = isEnum ? 'enum' : isDataType && dt ? primitiveToLogical(dt.baseType) : primitiveToLogical(prop.type as string)

    const isPrimaryKey = prop.name === 'id'

    const dtMaxLength = dt?.tags['maxLength'] ?? dt?.tags['max']
    const dtPrecision  = dt?.tags['precision']
    const dtScale      = dt?.tags['scale']

    return {
      property: prop.name,
      column: columnName,
      logicalType,
      dataTypeName: isDataType ? (prop.type as string) : undefined,
      length: prop.length ?? (dtMaxLength ? Number(dtMaxLength) : logicalType === 'string' ? 255 : undefined),
      precision: prop.precision ?? (dtPrecision ? Number(dtPrecision) : undefined),
      scale: prop.scale ?? (dtScale ? Number(dtScale) : undefined),
      nullable: prop.isNullable ?? !isPrimaryKey,
      unique: isPrimaryKey,
      primaryKey: isPrimaryKey,
      generated: isPrimaryKey && isPrimitive(prop.type as string) && prop.type === 'uuid'
        ? 'uuid'
        : isPrimaryKey
          ? 'uuid'
          : undefined,
      defaultValue: prop.defaultValue,
    }
  }

  private mapRelation(
    rel: Relation,
    ownerTable: string,
    model: ObjectModel,
  ): RelationMapping {
    const targetType = model.types.find(t => t.name === rel.target)
    const targetTable = targetType
      ? this.naming.tableName(targetType.name)
      : this.naming.tableName(rel.target)

    const mapping: RelationMapping = {
      property: rel.name,
      relationType: rel.type,
      target: rel.target,
      mappedBy: rel.mappedBy,
      cascade: rel.isOwning ? ['PERSIST', 'MERGE'] : undefined,
    }

    switch (rel.type) {
      case 'many_to_one':
      case 'one_to_one': {
        if (rel.isOwning) {
          const fkCol = this.naming.columnName(`${rel.name}Id`)
          // FK constraint name is generated in the schema transformer; computed here for reference only
          void this.naming.foreignKeyName(ownerTable, targetTable, fkCol)
          mapping.joinColumn = fkCol
          mapping.isOwning = true
        }
        break
      }
      case 'many_to_many': {
        if (rel.isOwning) {
          const joinTableName = this.naming.joinTableName(ownerTable, targetTable)
          const joinCol = this.naming.columnName(`${rel.name}Id`)
          const inverseJoinCol = this.naming.columnName(`${rel.target.toLowerCase()}Id`)

          const jt: JoinTableMapping = {
            name: joinTableName,
            joinColumn: joinCol,
            inverseJoinColumn: inverseJoinCol,
          }
          mapping.joinTable = jt
        }
        break
      }
      case 'one_to_many':
      default:
        // The FK lives on the target table — nothing to add here
        break
    }

    return mapping
  }
}
