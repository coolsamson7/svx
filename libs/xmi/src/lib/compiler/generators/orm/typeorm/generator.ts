/**
 * TypeORM entity code generator.
 * Produces TypeScript source files with TypeORM decorators.
 */

function posixDirname(p: string) { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i) }
function posixRelative(from: string, to: string) {
  const a = from ? from.split('/') : [], b = to ? to.split('/') : []
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++
  return [...Array(a.length - i).fill('..'), ...b.slice(i)].join('/') || '.'
}
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

    const schGrouping      = tsFiles.schemaGrouping   ?? 'per-type'
    const schFileName      = tsFiles.schemaFileName   ?? 'entity-schemas'
    const entityFileSuffix = tsFiles.entityFileSuffix ?? 'entity'
    const entitySubDir     = tsFiles.entitySubDir     ?? ''
    const schemaFileSuffix = tsFiles.schemaFileSuffix ?? 'schema'
    const schemaSubDir     = tsFiles.schemaSubDir     ?? ''

    const entSuffix = entityFileSuffix ? `.${entityFileSuffix}` : ''
    const schSuffix = schemaFileSuffix ? `.${schemaFileSuffix}` : ''

    const entSubParts  = entitySubDir ? [entitySubDir] : []
    const schSubParts  = schemaSubDir ? [schemaSubDir] : []

    const enumNames = new Set(objectModel.enums.map(e => e.name))
    const enumValues = new Map(objectModel.enums.map(e => [e.name, e.values]))
    const typeByName = new Map(objectModel.types.map(t => [t.name, t]))

    // Abstract types: generate plain TypeScript abstract classes (no TypeORM decorators)
    for (const type of objectModel.types) {
      if (!type.isAbstract) continue
      const stem = naming.tsFileStem(type.name)
      const entityRelPath = [...entSubParts, ...type.packagePath, `${stem}${entSuffix}.ts`].join('/')
      const source = this.generateAbstractEntity(type, enumNames, naming)
      result.set(entityRelPath, source)
    }

    // Concrete types: full TypeORM entity classes
    for (const type of objectModel.types) {
      if (type.isAbstract) continue

      const mapping = persistenceModel.mappings[type.name]
      if (!mapping) continue

      const stem = naming.tsFileStem(type.name)
      const entityRelPath = [...entSubParts, ...type.packagePath, `${stem}${entSuffix}.ts`].join('/')
      const entityFileFromOutput = [entitiesDir, entityRelPath].filter(Boolean).join('/')

      // Compute relative import path from this entity file to its schema constant
      let schemaImportPath: string
      if (schGrouping === 'per-type') {
        const schemaStem = naming.tsFileStem(type.name)
        const schemaFileFromOutput = [schemasDir, ...schSubParts, ...type.packagePath, `${schemaStem}${schSuffix}`].filter(Boolean).join('/')
        schemaImportPath = relativeImport(entityFileFromOutput, schemaFileFromOutput)
      } else {
        const schemaFileFromOutput = [schemasDir, ...schSubParts, schFileName].filter(Boolean).join('/')
        schemaImportPath = relativeImport(entityFileFromOutput, schemaFileFromOutput)
      }

      // Compute relative import path to abstract parent, if any
      let parentImportPath: string | undefined
      const parentType = type.superType ? typeByName.get(type.superType) : undefined
      if (parentType?.isAbstract) {
        const parentStem = naming.tsFileStem(parentType.name)
        const parentFileFromOutput = [entitiesDir, ...entSubParts, ...parentType.packagePath, `${parentStem}${entSuffix}`].filter(Boolean).join('/')
        parentImportPath = relativeImport(entityFileFromOutput, parentFileFromOutput)
      }

      // Compute import paths for related entity classes
      const siblingImportPaths = new Map<string, string>()
      for (const rel of mapping.relations) {
        if (siblingImportPaths.has(rel.target) || rel.target === type.name) continue
        const targetType = typeByName.get(rel.target)
        if (!targetType) continue
        const targetStem = naming.tsFileStem(targetType.name)
        const targetRelPath = [...entSubParts, ...targetType.packagePath, `${targetStem}${entSuffix}`].filter(Boolean).join('/')
        const targetFileFromOutput = [entitiesDir, targetRelPath].filter(Boolean).join('/')
        siblingImportPaths.set(rel.target, relativeImport(entityFileFromOutput, targetFileFromOutput))
      }

      const source = this.generateEntity(type, mapping, objectModel, enumNames, enumValues, schemaImportPath, naming, parentImportPath, siblingImportPaths)
      result.set(entityRelPath, source)
    }

    return result
  }

  private generateAbstractEntity(
    type: ObjectType,
    enumNames: Set<string>,
    naming: NamingStrategy,
  ): string {
    const className = naming.entityName(type.name)
    const lines: string[] = []
    if (type.description) lines.push(`/** ${type.description} */`)
    lines.push(`export abstract class ${className} {`)
    for (const prop of type.properties) {
      if (prop.description) lines.push(`  /** ${prop.description} */`)
      const tsType = enumNames.has(prop.type as string) ? 'string' : primitiveToTs(prop.type as string)
      const nullable = prop.isNullable ? ' | null' : ''
      lines.push(`  ${prop.name}!: ${tsType}${nullable};`)
      lines.push('')
    }
    lines.push('}')
    return lines.join('\n')
  }

  private generateEntity(
    type: ObjectType,
    mapping: TypeMapping,
    objectModel: ObjectModel,
    enumNames: Set<string>,
    enumValues: Map<string, string[]>,
    schemaImportPath: string,
    naming: NamingStrategy,
    parentImportPath?: string,
    siblingImportPaths?: Map<string, string>,
  ): string {
    const className = naming.entityName(type.name)
    const parentClass = type.superType ? naming.entityName(type.superType) : undefined
    const decorators = new Set<string>(['Entity'])
    const lines: string[] = []

    // Build class body lines and collect needed decorators
    const bodyLines: string[] = []

    // Properties
    for (const field of mapping.fields) {
      // Find prop on own type first, then search ancestors
      const prop = type.properties.find(p => p.name === field.property)
        ?? this.findInheritedProp(objectModel, type, field.property)
        ?? { name: field.property, type: 'uuid', isNullable: false, description: undefined }

      const { line, usedDecorators } = this.generateProperty(field, prop.type as string, enumNames, enumValues, prop.description)
      line.forEach(l => bodyLines.push(l))
      usedDecorators.forEach(d => decorators.add(d))
    }

    // Relations
    for (const rel of mapping.relations) {
      const { line, usedDecorators } = this.generateRelation(rel, type.name, objectModel, naming)
      line.forEach(l => bodyLines.push(l))
      usedDecorators.forEach(d => decorators.add(d))
    }

    // Build import lines
    const importLine = `import { ${[...decorators].sort().join(', ')} } from 'typeorm';`

    lines.push(importLine)
    lines.push(`import { Reflectable, Implements } from '@svx/common';`)
    lines.push(`import { ${type.name}Schema } from '${schemaImportPath}';`)
    if (parentImportPath && parentClass) {
      lines.push(`import { ${parentClass} } from '${parentImportPath}';`)
    }
    if (siblingImportPaths) {
      for (const [targetName, importPath] of siblingImportPaths) {
        lines.push(`import { ${naming.entityName(targetName)} } from '${importPath}';`)
      }
    }
    lines.push('')
    if (type.description) {
      lines.push(`/** ${type.description} */`)
    }
    const extendsClause = parentClass ? ` extends ${parentClass}` : ''
    lines.push(`@Reflectable() @Implements(${type.name}Schema) @Entity("${mapping.table}")`)
    lines.push(`export class ${className}${extendsClause} {`)
    bodyLines.forEach(l => lines.push(`  ${l}`))
    lines.push('}')

    return lines.join('\n')
  }

  private findInheritedProp(objectModel: ObjectModel, type: ObjectType, propName: string) {
    const byName = new Map(objectModel.types.map(t => [t.name, t]))
    let cur = type.superType ? byName.get(type.superType) : undefined
    while (cur) {
      const prop = cur.properties.find(p => p.name === propName)
      if (prop) return prop
      cur = cur.superType ? byName.get(cur.superType) : undefined
    }
    return undefined
  }

  private generateProperty(
    field: FieldMapping,
    typeName: string,
    enumNames: Set<string>,
    enumValues: Map<string, string[]>,
    description?: string,
  ): { line: string[]; usedDecorators: string[] } {
    const lines: string[] = []
    const usedDecorators: string[] = []

    const isEnum = enumNames.has(typeName) || field.logicalType === 'enum'

    if (description) lines.push(`/** ${description} */`)

    if (field.primaryKey) {
      if (field.generated === 'uuid') {
        usedDecorators.push('PrimaryGeneratedColumn')
        lines.push(`@PrimaryGeneratedColumn("uuid", { name: "${field.column}" })`)
        lines.push(`${field.property}!: string;`)
      } else if (field.generated === 'increment') {
        usedDecorators.push('PrimaryGeneratedColumn')
        lines.push(`@PrimaryGeneratedColumn({ name: "${field.column}" })`)
        lines.push(`${field.property}!: number;`)
      } else {
        usedDecorators.push('PrimaryColumn')
        lines.push(`@PrimaryColumn({ name: "${field.column}" })`)
        lines.push(`${field.property}!: string;`)
      }
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
    naming: NamingStrategy,
  ): { line: string[]; usedDecorators: string[] } {
    const lines: string[] = []
    const usedDecorators: string[] = []

    const targetClass = naming.entityName(rel.target)
    const targetVar = rel.target.toLowerCase()

    const cascadeStr = rel.cascade === true ? 'true'
      : Array.isArray(rel.cascade) ? `[${rel.cascade.map(c => `'${c}'`).join(', ')}]`
      : undefined
    const onDeleteStr = rel.onDelete ? `, { onDelete: '${rel.onDelete}' }` : ''

    switch (rel.relationType) {
      case 'one_to_many': {
        usedDecorators.push('OneToMany')
        const inverseProp = rel.mappedBy ?? targetVar
        const opts = cascadeStr ? `, { cascade: ${cascadeStr} }` : ''
        lines.push(`@OneToMany(() => ${targetClass}, (${targetVar}: ${targetClass}) => ${targetVar}.${inverseProp}${opts})`)
        lines.push(`${rel.property}!: ${targetClass}[];`)
        lines.push('')
        break
      }
      case 'many_to_one': {
        usedDecorators.push('ManyToOne', 'JoinColumn')
        const inverseProp = rel.mappedBy
          ?? this.findInverseRelationName(objectModel, rel.target, _ownerTypeName)
          ?? _ownerTypeName.toLowerCase()
        const mtoOpts = cascadeStr ? `, { cascade: ${cascadeStr} }` : ''
        lines.push(`@ManyToOne(() => ${targetClass}, (${targetVar}: ${targetClass}) => ${targetVar}.${inverseProp}${mtoOpts})`)
        if (rel.joinColumn) {
          const jcOpts = rel.onDelete ? `, onDelete: '${rel.onDelete}'` : ''
          lines.push(`@JoinColumn({ name: "${rel.joinColumn}"${jcOpts} })`)
        }
        lines.push(`${rel.property}!: ${targetClass};`)
        lines.push('')
        break
      }
      case 'one_to_one': {
        if (rel.mappedBy) {
          usedDecorators.push('OneToOne')
          lines.push(`@OneToOne(() => ${targetClass}, (${targetVar}: ${targetClass}) => ${targetVar}.${rel.mappedBy}${onDeleteStr})`)
          lines.push(`${rel.property}!: ${targetClass};`)
        } else {
          usedDecorators.push('OneToOne', 'JoinColumn')
          lines.push(`@OneToOne(() => ${targetClass}${onDeleteStr})`)
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
          const inverseProp = rel.mappedBy ?? targetVar
          lines.push(`@ManyToMany(() => ${targetClass}, (${targetVar}: ${targetClass}) => ${targetVar}.${inverseProp})`)
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
  const fromDir = posixDirname(fromFile)
  const rel = posixRelative(fromDir, toPath)
  return rel.startsWith('.') ? rel : `./${rel}`
}
