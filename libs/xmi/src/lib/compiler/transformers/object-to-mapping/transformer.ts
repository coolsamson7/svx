/**
 * ObjectModel → PersistenceModel transformer.
 * Applies naming strategy and inheritance strategy, producing full persistence mappings.
 */

import type { ObjectModel, ObjectType, Property, Relation, DataType } from '../../model/object/types.js'
import type {
  PersistenceModel, TypeMapping, FieldMapping, RelationMapping, JoinTableMapping,
} from '../../model/mapping/types.js'
import type { NamingStrategy } from '../../naming/strategy.js'
import { primitiveToLogical } from '../../utils/type-utils.js'

export interface TransformerOptions {
  inheritanceStrategy?: 'table_per_class' | 'single_table' | 'joined'
  dataTypeOverrides?: Record<string, { baseType?: string; tags?: Record<string, string> }>
}

interface Ctx {
  byName: Map<string, ObjectType>
  enumNames: Set<string>
  dtNames: Set<string>
  dtByName: Map<string, DataType>
  model: ObjectModel
}

export class ObjectToMappingTransformer {
  private readonly naming: NamingStrategy
  private readonly strategy: 'table_per_class' | 'single_table' | 'joined'
  private readonly dtOverrides: Record<string, { baseType?: string; tags?: Record<string, string> }>

  constructor(naming: NamingStrategy, options?: TransformerOptions) {
    this.naming = naming
    this.strategy = options?.inheritanceStrategy ?? 'table_per_class'
    this.dtOverrides = options?.dataTypeOverrides ?? {}
  }

  transform(model: ObjectModel): PersistenceModel {
    const effectiveDts = this.applyDtOverrides(model.dataTypes)
    const enriched: ObjectModel = { ...model, dataTypes: effectiveDts }
    const ctx: Ctx = {
      byName: new Map(enriched.types.map(t => [t.name, t])),
      enumNames: new Set(enriched.enums.map(e => e.name)),
      dtNames: new Set(effectiveDts.map(d => d.name)),
      dtByName: new Map(effectiveDts.map(d => [d.name, d])),
      model: enriched,
    }
    switch (this.strategy) {
      case 'single_table': return this.singleTable(ctx)
      case 'joined':       return this.joined(ctx)
      default:             return this.tablePerClass(ctx)
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Table name: explicit `table-name` tag overrides the naming convention. */
  private tableNameFor(type: import('../../model/object/types.js').ObjectType): string {
    return type.tags?.['tableName'] ?? this.naming.tableName(type.name)
  }

  // ── TABLE_PER_CLASS ────────────────────────────────────────────────────────
  // Concrete types only; abstract types' columns are flattened into each subclass.

  private tablePerClass(ctx: Ctx): PersistenceModel {
    const mappings: Record<string, TypeMapping> = {}
    for (const type of ctx.model.types) {
      if (type.isAbstract) continue
      const table = this.tableNameFor(type)
      const fields = this.buildFields(this.collectAllProps(type, ctx.byName), ctx)
      const relations = type.relations.map(r => this.mapRelation(r, table, ctx.model))
      mappings[type.name] = { typeName: type.name, table, fields, relations }
    }
    return { mappings }
  }

  // ── JOINED ────────────────────────────────────────────────────────────────
  // Every class (abstract and concrete) gets its own table with only its OWN
  // columns. Concrete subclasses have a PK that is also a FK to the parent.

  private joined(ctx: Ctx): PersistenceModel {
    const mappings: Record<string, TypeMapping> = {}
    for (const type of ctx.model.types) {
      const table = this.tableNameFor(type)
      const parentName = !type.isAbstract && type.superType && ctx.byName.get(type.superType)?.isAbstract
        ? type.superType : undefined

      let fields: FieldMapping[]
      if (parentName) {
        // Concrete subclass: PK is shared with parent (no auto-generation here)
        const pkCol = this.naming.columnName('id')
        const pkField: FieldMapping = {
          property: 'id', column: pkCol, logicalType: 'uuid',
          nullable: false, unique: true, primaryKey: true,
        }
        fields = [pkField, ...type.properties.filter(p => p.name !== 'id').map(p => this.mapProperty(p, ctx))]
      } else {
        fields = this.buildFields(type.properties, ctx)
      }

      const relations = type.isAbstract ? [] : type.relations.map(r => this.mapRelation(r, table, ctx.model))
      mappings[type.name] = {
        typeName: type.name, table, fields, relations,
        inheritanceStrategy: 'JOINED',
        joinedParent: parentName,
      }
    }
    return { mappings }
  }

  // ── SINGLE_TABLE ──────────────────────────────────────────────────────────
  // All concrete types in a hierarchy share one physical table named after the
  // root abstract type. A DTYPE discriminator column is added.

  private singleTable(ctx: Ctx): PersistenceModel {
    const mappings: Record<string, TypeMapping> = {}

    // Group concrete types by their root abstract ancestor
    const hierarchies = new Map<string, { root: ObjectType; concretes: ObjectType[] }>()
    const standalone: ObjectType[] = []

    for (const type of ctx.model.types) {
      if (type.isAbstract) continue
      const root = this.findRootAbstract(type, ctx.byName)
      if (root) {
        if (!hierarchies.has(root.name)) hierarchies.set(root.name, { root, concretes: [] })
        hierarchies.get(root.name)!.concretes.push(type)
      } else {
        standalone.push(type)
      }
    }

    // Standalone types: individual tables (no hierarchy)
    for (const type of standalone) {
      const table = this.tableNameFor(type)
      const fields = this.buildFields(type.properties, ctx)
      const relations = type.relations.map(r => this.mapRelation(r, table, ctx.model))
      mappings[type.name] = { typeName: type.name, table, fields, relations }
    }

    // Hierarchy types: one physical table per root abstract type
    for (const [, { root, concretes }] of hierarchies) {
      const table = this.tableNameFor(root)
      const rootPropNames = new Set(root.properties.map(p => p.name))

      // Collect subclass-specific properties (nullable in the shared table)
      const extraProps: Property[] = []
      const seen = new Set<string>(rootPropNames)
      for (const type of concretes) {
        for (const prop of type.properties) {
          if (!seen.has(prop.name)) {
            seen.add(prop.name)
            extraProps.push({ ...prop, isNullable: true })
          }
        }
      }

      // Merged layout: DTYPE discriminator, then root props, then subclass-specific props
      const dtypeProp: Property = { name: 'dtype', type: 'string', isNullable: false }
      const mergedProps: Property[] = [dtypeProp, ...root.properties, ...extraProps]

      // Each concrete type maps to the same physical table
      for (const type of concretes) {
        const fields = this.buildFields(mergedProps, ctx)
        const relations = type.relations.map(r => this.mapRelation(r, table, ctx.model))
        mappings[type.name] = {
          typeName: type.name, table, fields, relations,
          inheritanceStrategy: 'SINGLE_TABLE',
          discriminatorColumn: this.naming.columnName('dtype'),
          discriminatorValue: type.name,
        }
      }
    }

    return { mappings }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Build a fields array from a property list, auto-adding UUID PK when absent. */
  private buildFields(props: Property[], ctx: Ctx): FieldMapping[] {
    const fields: FieldMapping[] = []
    const hasId = props.some(p => p.name === 'id')
    if (!hasId) {
      fields.push({
        property: 'id', column: this.naming.columnName('id'),
        logicalType: 'uuid', nullable: false, unique: true, primaryKey: true, generated: 'uuid',
      })
    }
    for (const prop of props) {
      fields.push(this.mapProperty(prop, ctx))
    }
    return fields
  }

  /** Walk up the inheritance chain and return all properties (ancestors first). */
  private collectAllProps(type: ObjectType, byName: Map<string, ObjectType>): Property[] {
    const chains: Property[][] = []
    let cur: ObjectType | undefined = type.superType ? byName.get(type.superType) : undefined
    while (cur) {
      chains.unshift(cur.properties)
      cur = cur.superType ? byName.get(cur.superType) : undefined
    }
    chains.push(type.properties)
    return chains.flat()
  }

  /** Find the topmost abstract ancestor in the hierarchy (if any). */
  private findRootAbstract(type: ObjectType, byName: Map<string, ObjectType>): ObjectType | undefined {
    let root: ObjectType | undefined
    let cur: ObjectType | undefined = type.superType ? byName.get(type.superType) : undefined
    while (cur?.isAbstract) {
      root = cur
      cur = cur.superType ? byName.get(cur.superType) : undefined
    }
    return root
  }

  /** Apply config-level DataType overrides before processing. */
  private applyDtOverrides(dts: DataType[]): DataType[] {
    const result = dts.map(dt => {
      const ov = this.dtOverrides[dt.name]
      if (!ov) return dt
      return { ...dt, baseType: ov.baseType ?? dt.baseType, tags: { ...dt.tags, ...(ov.tags ?? {}) } } as DataType
    })
    for (const [name, ov] of Object.entries(this.dtOverrides)) {
      if (!result.some(d => d.name === name)) {
        result.push({ name, baseType: (ov.baseType ?? 'string') as DataType['baseType'], tags: ov.tags ?? {}, packagePath: [] })
      }
    }
    return result
  }

  private mapProperty(prop: Property, ctx: Ctx): FieldMapping {
    const { enumNames, dtNames, dtByName } = ctx
    const isEnum = prop.isEnum || enumNames.has(prop.type as string)
    const isDataType = !isEnum && dtNames.has(prop.type as string)
    const dt = isDataType ? dtByName.get(prop.type as string) : undefined
    const logicalType = isEnum ? 'enum'
      : isDataType && dt ? primitiveToLogical(dt.baseType)
      : primitiveToLogical(prop.type as string)

    const tags = prop.tags ?? {}
    const isPrimaryKey = tags['primaryKey'] === 'true' || prop.name === 'id'
    const generatedTag = tags['generated']
    const generated = isPrimaryKey
      ? (generatedTag === 'increment' || logicalType === 'integer' || logicalType === 'long'
          ? 'increment'
          : generatedTag === 'uuid' || !generatedTag ? 'uuid' : 'uuid')
      : undefined

    const dtMaxLength = dt?.tags['maxLength'] ?? dt?.tags['max']
    const attrMaxLength = tags['maxLength'] ?? tags['max']
    const dtPrecision = dt?.tags['precision']
    const dtScale = dt?.tags['scale']

    // Explicit tagged-value overrides take priority over naming conventions
    const columnOverride = tags['columnName']
    const sqlTypeOverride = tags['columnType'] || undefined
    const uniqueOverride = tags['unique'] === 'true'
    const nullableOverride = tags['nullable'] !== undefined
      ? tags['nullable'] === 'true'
      : undefined

    return {
      property: prop.name,
      column: columnOverride ?? this.naming.columnName(prop.name),
      logicalType,
      dataTypeName: isDataType ? (prop.type as string) : undefined,
      sqlTypeOverride,
      length: prop.length ?? (attrMaxLength ? Number(attrMaxLength) : dtMaxLength ? Number(dtMaxLength) : logicalType === 'string' ? 255 : undefined),
      precision: prop.precision ?? (dtPrecision ? Number(dtPrecision) : undefined),
      scale: prop.scale ?? (dtScale ? Number(dtScale) : undefined),
      nullable: isPrimaryKey ? false : (nullableOverride ?? prop.isNullable ?? true),
      unique: isPrimaryKey || uniqueOverride,
      primaryKey: isPrimaryKey,
      generated,
      defaultValue: prop.defaultValue,
    }
  }

  private mapRelation(rel: Relation, ownerTable: string, model: ObjectModel): RelationMapping {
    const targetType = model.types.find(t => t.name === rel.target)
    const targetTable = targetType
      ? this.tableNameFor(targetType)
      : this.naming.tableName(rel.target)

    const mapping: RelationMapping = {
      property: rel.name,
      relationType: rel.type,
      target: rel.target,
      mappedBy: rel.mappedBy,
      cascade: rel.cascade,
      onDelete: rel.onDelete,
    }

    switch (rel.type) {
      case 'many_to_one':
      case 'one_to_one': {
        if (rel.isOwning) {
          const fkCol = this.naming.fkColumnName(rel.name, rel.target)
          void this.naming.foreignKeyName(ownerTable, targetTable, fkCol)
          mapping.joinColumn = fkCol
          mapping.isOwning = true
        }
        break
      }
      case 'many_to_many': {
        if (rel.isOwning) {
          const joinTableName = this.naming.joinTableName(ownerTable, targetTable)
          const joinCol = this.naming.fkColumnName(rel.name, rel.target)
          const inverseJoinCol = this.naming.fkColumnName(rel.target.toLowerCase(), rel.target)
          const jt: JoinTableMapping = { name: joinTableName, joinColumn: joinCol, inverseJoinColumn: inverseJoinCol }
          mapping.joinTable = jt
        }
        break
      }
    }

    return mapping
  }
}
