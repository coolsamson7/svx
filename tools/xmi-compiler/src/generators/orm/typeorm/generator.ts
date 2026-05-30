/**
 * TypeORM entity code generator.
 * Produces TypeScript source files with TypeORM decorators.
 */

import { posix } from 'node:path'
import type { ObjectModel, ObjectType } from '../../../model/object/types.js'
import type { PersistenceModel, TypeMapping, FieldMapping, RelationMapping } from '../../../model/mapping/types.js'
import type { NamingStrategy } from '../../../naming/strategy.js'
import type { TsFileNamingConfig } from '../../../config/types.js'
import { primitiveToTs } from '../../../utils/type-utils.js'

export interface TypeOrmGeneratorConfig {
  naming: NamingStrategy
  tsFiles: TsFileNamingConfig
  /** Path from outputDir to the entities output dir (e.g. 'entities') */
  entitiesDir: string
  /** Path from outputDir to the schemas output dir (e.g. 'schemas') */
  schemasDir: string
}

/**
 * Generates TypeORM entity TypeScript source files from an ObjectModel + PersistenceModel.
 * Returns a map of relativeFilePath (from entitiesDir) → TypeScript source string.
 */
export class TypeOrmGenerator {
  generate(
    objectModel: ObjectModel,
    persistenceModel: PersistenceModel,
    cfg: TypeOrmGeneratorConfig,
  ): Map<string, string> {
    const result = new Map<string, string>()
    const { naming, tsFiles, entitiesDir, schemasDir } = cfg

    const schGrouping  = tsFiles.schemaGrouping ?? 'per-type'
    const schFileName  = tsFiles.schemaFileName ?? 'entity-schemas'

    const enumNames = new Set(objectModel.enums.map(e => e.name))
    const enumValues = new Map(objectModel.enums.map(e => [e.name, e.values]))

    for (const type of objectModel.types) {
      if (type.isAbstract) continue

      const mapping = persistenceModel.mappings[type.name]
      if (!mapping) continue

      const stem = naming.tsFileStem(type.name)
      const entityRelPath = [...type.packagePath, `${stem}.entity.ts`].join('/')
      const entityFileFromOutput = `${entitiesDir}/${entityRelPath}`

      // Compute relative import path from this entity file to its schema constant
      let schemaImportPath: string
      if (schGrouping === 'per-type') {
        const schemaStem = naming.tsFileStem(type.name)
        const schemaFileFromOutput = `${schemasDir}/${[...type.packagePath, `${schemaStem}.schema`].join('/')}`
        schemaImportPath = relativeImport(entityFileFromOutput, schemaFileFromOutput)
      } else {
        const schemaFileFromOutput = `${schemasDir}/${schFileName}`
        schemaImportPath = relativeImport(entityFileFromOutput, schemaFileFromOutput)
      }

      const source = this.generateEntity(type, mapping, objectModel, enumNames, enumValues, schemaImportPath)
      result.set(entityRelPath, source)
    }

    return result
  }

  private generateEntity(
    type: ObjectType,
    mapping: TypeMapping,
    objectModel: ObjectModel,
    enumNames: Set<string>,
    enumValues: Map<string, string[]>,
    schemaImportPath: string,
  ): string {
    const decorators = new Set<string>(['Entity'])
    const lines: string[] = []

    // Build class body lines and collect needed decorators
    const bodyLines: string[] = []

    // Properties
    for (const field of mapping.fields) {
      const prop = type.properties.find(p => p.name === field.property)
        ?? { name: field.property, type: 'uuid', isNullable: false }

      const { line, usedDecorators } = this.generateProperty(field, prop.type as string, enumNames, enumValues)
      line.forEach(l => bodyLines.push(l))
      usedDecorators.forEach(d => decorators.add(d))
    }

    // Relations
    for (const rel of mapping.relations) {
      const { line, usedDecorators } = this.generateRelation(rel, type.name, objectModel)
      line.forEach(l => bodyLines.push(l))
      usedDecorators.forEach(d => decorators.add(d))
    }

    // Build import lines
    const importLine = `import { ${[...decorators].sort().join(', ')} } from 'typeorm';`

    lines.push(importLine)
    lines.push(`import { Reflectable, Implements } from '@svx/common';`)
    lines.push(`import { ${type.name}Schema } from '${schemaImportPath}';`)
    lines.push('')
    lines.push(`@Reflectable() @Implements(${type.name}Schema) @Entity("${mapping.table}")`)
    lines.push(`export class ${type.name} {`)
    bodyLines.forEach(l => lines.push(`  ${l}`))
    lines.push('}')

    return lines.join('\n')
  }

  private generateProperty(
    field: FieldMapping,
    typeName: string,
    enumNames: Set<string>,
    enumValues: Map<string, string[]>,
  ): { line: string[]; usedDecorators: string[] } {
    const lines: string[] = []
    const usedDecorators: string[] = []

    const isEnum = enumNames.has(typeName) || field.logicalType === 'enum'

    if (field.primaryKey) {
      if (field.generated === 'uuid') {
        usedDecorators.push('PrimaryGeneratedColumn')
        lines.push(`@PrimaryGeneratedColumn("uuid")`)
      } else if (field.generated === 'increment') {
        usedDecorators.push('PrimaryGeneratedColumn')
        lines.push(`@PrimaryGeneratedColumn("increment")`)
      } else {
        usedDecorators.push('PrimaryColumn')
        lines.push(`@PrimaryColumn()`)
      }
      lines.push(`${field.property}!: string;`)
      lines.push('')
      return { line: lines, usedDecorators }
    }

    // Build @Column options
    const opts: string[] = []
    opts.push(`name: "${field.column}"`)

    if (isEnum && enumValues.has(typeName)) {
      opts.push(`type: "varchar"`)
      if (field.length) opts.push(`length: ${field.length}`)
    } else {
      const sqlType = this.logicalToSqlType(field.logicalType)
      opts.push(`type: "${sqlType}"`)
      if (field.length) opts.push(`length: ${field.length}`)
      if (field.precision !== undefined) opts.push(`precision: ${field.precision}`)
      if (field.scale !== undefined) opts.push(`scale: ${field.scale}`)
    }

    if (field.nullable) opts.push(`nullable: true`)
    if (field.unique) opts.push(`unique: true`)
    if (field.defaultValue !== undefined) {
      const dv = typeof field.defaultValue === 'string'
        ? `"${field.defaultValue}"`
        : String(field.defaultValue)
      opts.push(`default: ${dv}`)
    }

    usedDecorators.push('Column')
    lines.push(`@Column({ ${opts.join(', ')} })`)

    const tsType = isEnum ? 'string' : primitiveToTs(typeName)
    const nullSuffix = field.nullable ? ' | null' : ''
    lines.push(`${field.property}!: ${tsType}${nullSuffix};`)
    lines.push('')

    return { line: lines, usedDecorators }
  }

  private generateRelation(
    rel: RelationMapping,
    _ownerTypeName: string,
    objectModel: ObjectModel,
  ): { line: string[]; usedDecorators: string[] } {
    const lines: string[] = []
    const usedDecorators: string[] = []

    const targetType = objectModel.types.find(t => t.name === rel.target)
    const targetClass = rel.target

    switch (rel.relationType) {
      case 'one_to_many': {
        usedDecorators.push('OneToMany')
        const inverseProp = rel.mappedBy ?? targetClass.toLowerCase()
        lines.push(`@OneToMany(() => ${targetClass}, (${targetClass.toLowerCase()}: ${targetClass}) => ${targetClass.toLowerCase()}.${inverseProp})`)
        lines.push(`${rel.property}!: ${targetClass}[];`)
        lines.push('')
        break
      }
      case 'many_to_one': {
        usedDecorators.push('ManyToOne', 'JoinColumn')
        const inverseProp = rel.mappedBy
          ?? this.findInverseRelationName(objectModel, rel.target, _ownerTypeName)
          ?? _ownerTypeName.toLowerCase()
        lines.push(`@ManyToOne(() => ${targetClass}, (${targetClass.toLowerCase()}: ${targetClass}) => ${targetClass.toLowerCase()}.${inverseProp})`)
        if (rel.joinColumn) {
          lines.push(`@JoinColumn({ name: "${rel.joinColumn}" })`)
        }
        lines.push(`${rel.property}!: ${targetClass};`)
        lines.push('')
        break
      }
      case 'one_to_one': {
        if (rel.mappedBy) {
          usedDecorators.push('OneToOne')
          lines.push(`@OneToOne(() => ${targetClass}, (${targetClass.toLowerCase()}: ${targetClass}) => ${targetClass.toLowerCase()}.${rel.mappedBy})`)
          lines.push(`${rel.property}!: ${targetClass};`)
        } else {
          usedDecorators.push('OneToOne', 'JoinColumn')
          lines.push(`@OneToOne(() => ${targetClass})`)
          if (rel.joinColumn) {
            lines.push(`@JoinColumn({ name: "${rel.joinColumn}" })`)
          } else {
            lines.push(`@JoinColumn()`)
          }
          lines.push(`${rel.property}!: ${targetClass};`)
        }
        lines.push('')
        break
      }
      case 'many_to_many': {
        if (rel.joinTable) {
          usedDecorators.push('ManyToMany', 'JoinTable')
          lines.push(`@ManyToMany(() => ${targetClass})`)
          lines.push(`@JoinTable({`)
          lines.push(`  name: "${rel.joinTable.name}",`)
          lines.push(`  joinColumn: { name: "${rel.joinTable.joinColumn}" },`)
          lines.push(`  inverseJoinColumn: { name: "${rel.joinTable.inverseJoinColumn}" },`)
          lines.push(`})`)
        } else {
          usedDecorators.push('ManyToMany')
          const inverseProp = rel.mappedBy ?? targetClass.toLowerCase()
          lines.push(`@ManyToMany(() => ${targetClass}, (${targetClass.toLowerCase()}: ${targetClass}) => ${targetClass.toLowerCase()}.${inverseProp})`)
        }
        lines.push(`${rel.property}!: ${targetClass}[];`)
        lines.push('')
        break
      }
    }

    return { line: lines, usedDecorators }
  }

  private findInverseRelationName(
    model: ObjectModel,
    targetTypeName: string,
    ownerTypeName: string,
  ): string | undefined {
    const targetType = model.types.find(t => t.name === targetTypeName)
    if (!targetType) return undefined
    const inverseRel = targetType.relations.find(r => r.target === ownerTypeName)
    return inverseRel?.name
  }

  private logicalToSqlType(logicalType: string): string {
    const map: Record<string, string> = {
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
    return map[logicalType] ?? 'varchar'
  }
}

function relativeImport(fromFile: string, toPath: string): string {
  const fromDir = posix.dirname(fromFile)
  const rel = posix.relative(fromDir, toPath)
  return rel.startsWith('.') ? rel : `./${rel}`
}
