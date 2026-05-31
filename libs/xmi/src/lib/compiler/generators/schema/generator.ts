/**
 * Schema mapper generator — per-file output.
 *
 * Returns Map<relativeFilePath, content> where paths are relative to the
 * schemas output directory (e.g. 'user/user.schema.ts', 'data-types.ts').
 *
 * Grouping rules (from TsFileNamingConfig):
 *   dataTypeGrouping 'one'      → all DataTypes in one file (dataTypeFileName)
 *   dataTypeGrouping 'per-type' → one file per DataType
 *   schemaGrouping   'per-type' → one file per entity schema (default)
 *   schemaGrouping   'one'      → all entity schemas in one file (schemaFileName)
 *
 * Package path from uml:Package nesting becomes the sub-directory prefix.
 */

function posixDirname(p: string) { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i) }
function posixRelative(from: string, to: string) {
  const a = from ? from.split('/') : [], b = to ? to.split('/') : []
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++
  return [...Array(a.length - i).fill('..'), ...b.slice(i)].join('/') || '.'
}
import type { ObjectModel, DataType } from '../../model/object/types.js'
import type { PersistenceModel, FieldMapping } from '../../model/mapping/types.js'
import type { NamingStrategy } from '../../naming/strategy.js'
import type { TsFileNamingConfig } from '../../config/types.js'

export interface SchemaGeneratorConfig {
  naming: NamingStrategy
  tsFiles: TsFileNamingConfig
}

export class SchemaMapperGenerator {
  generate(
    objectModel: ObjectModel,
    persistenceModel: PersistenceModel,
    cfg: SchemaGeneratorConfig,
  ): Map<string, string> {
    const { naming, tsFiles } = cfg
    const dtGrouping       = tsFiles.dataTypeGrouping  ?? 'one'
    const dtFileName       = tsFiles.dataTypeFileName  ?? 'data-types'
    const schGrouping      = tsFiles.schemaGrouping    ?? 'per-type'
    const schFileName      = tsFiles.schemaFileName    ?? 'entity-schemas'
    const schemaFileSuffix = tsFiles.schemaFileSuffix  ?? 'schema'
    const schemaSubDir     = tsFiles.schemaSubDir      ?? ''

    const schSuffix   = schemaFileSuffix ? `.${schemaFileSuffix}` : ''
    const schSubParts = schemaSubDir ? [schemaSubDir] : []

    const result = new Map<string, string>()
    const dataTypeNames = new Set(objectModel.dataTypes.map(d => d.name))

    // ── DataType constants ────────────────────────────────────────────────────
    if (dtGrouping === 'one') {
      const needed = new Set<string>()
      const lines: string[] = []
      for (const dt of objectModel.dataTypes) {
        const { expr, imps } = this.dataTypeExpr(dt)
        imps.forEach(i => needed.add(i))
        if (dt.description) lines.push(`/** ${dt.description} */`)
        lines.push(`export const ${dt.name} = ${expr};`)
      }
      if (lines.length > 0) {
        result.set(`${dtFileName}.ts`, this.withImports(needed, lines))
      }
    } else {
      for (const dt of objectModel.dataTypes) {
        const { expr, imps } = this.dataTypeExpr(dt)
        const needed = new Set(imps)
        const lines: string[] = []
        if (dt.description) lines.push(`/** ${dt.description} */`)
        lines.push(`export const ${dt.name} = ${expr};`)
        const stem = naming.tsFileStem(dt.name)
        const filePath = [...dt.packagePath, `${stem}.ts`].join('/')
        result.set(filePath, this.withImports(needed, lines))
      }
    }

    // ── Entity schema constants (topologically sorted) ────────────────────────
    const typeNames = objectModel.types
      .filter(t => !t.isAbstract && persistenceModel.mappings[t.name])
      .map(t => t.name)

    const typeByName = new Map(objectModel.types.map(t => [t.name, t]))
    const sorted = this.topologicalSort(typeNames, persistenceModel)

    if (schGrouping === 'per-type') {
      for (const typeName of sorted) {
        const mapping = persistenceModel.mappings[typeName]
        const objType = typeByName.get(typeName)
        if (!mapping || !objType) continue

        const needed = new Set<string>()
        const importLines: string[] = []
        const props: string[] = []

        // Resolve imports for DataType references (could be in different files)
        const dtImportMap = new Map<string, string[]>() // importPath → names[]
        for (const field of mapping.fields) {
          if (field.dataTypeName && dataTypeNames.has(field.dataTypeName)) {
            const dt = objectModel.dataTypes.find(d => d.name === field.dataTypeName)!
            const dtImportPath = dtGrouping === 'one'
              ? dtFileName
              : [...dt.packagePath, naming.tsFileStem(dt.name)].join('/')
            const schemaFilePath = [...schSubParts, ...objType.packagePath, naming.tsFileStem(typeName)].join('/')
            const relPath = relativeImport(schemaFilePath, dtImportPath)
            const existing = dtImportMap.get(relPath) ?? []
            if (!existing.includes(field.dataTypeName)) existing.push(field.dataTypeName)
            dtImportMap.set(relPath, existing)
          }
        }

        // Resolve imports for relation schema references
        const relImportMap = new Map<string, string[]>() // importPath → names[]
        for (const rel of mapping.relations) {
          if (!persistenceModel.mappings[rel.target]) continue
          if (rel.relationType !== 'one_to_many' && rel.relationType !== 'many_to_many') continue
          const targetType = typeByName.get(rel.target)
          if (!targetType) continue
          const targetImportPath = [...schSubParts, ...targetType.packagePath, naming.tsFileStem(rel.target)].join('/')
          const schemaFilePath = [...schSubParts, ...objType.packagePath, naming.tsFileStem(typeName)].join('/')
          const relPath = relativeImport(schemaFilePath, `${targetImportPath}${schSuffix}`)
          const constName = `${rel.target}Schema`
          const existing = relImportMap.get(relPath) ?? []
          if (!existing.includes(constName)) existing.push(constName)
          relImportMap.set(relPath, existing)
        }

        // Build props
        for (const field of mapping.fields) {
          const { expr, imps } = this.fieldExpr(field, dataTypeNames)
          imps.forEach(i => needed.add(i))
          props.push(`  ${field.property}: ${expr},`)
        }
        for (const rel of mapping.relations) {
          if (!persistenceModel.mappings[rel.target]) continue
          if (rel.relationType === 'one_to_many' || rel.relationType === 'many_to_many') {
            needed.add('array')
            props.push(`  ${rel.property}: array(${rel.target}Schema),`)
          }
        }
        needed.add('object')

        // Build file content
        const valueImports = [...needed].filter(i => i !== 'InferObject').sort()
        const fileLines: string[] = []
        fileLines.push(`import { ${valueImports.join(', ')} } from '@svx/common';`)
        fileLines.push(`import type { InferObject } from '@svx/common';`)
        for (const [path, names] of dtImportMap)
          fileLines.push(`import { ${names.join(', ')} } from '${path}';`)
        for (const [path, names] of relImportMap)
          fileLines.push(`import { ${names.join(', ')} } from '${path}';`)
        fileLines.push('')
        if (objType.description) fileLines.push(`/** ${objType.description} */`)
        fileLines.push(`export const ${typeName}Schema = object({\n${props.join('\n')}\n}, '${typeName}');`)
        fileLines.push('')
        fileLines.push(`export type ${typeName}Type = InferObject<typeof ${typeName}Schema>`)

        const stem = naming.tsFileStem(typeName)
        const filePath = [...schSubParts, ...objType.packagePath, `${stem}${schSuffix}.ts`].join('/')
        result.set(filePath, fileLines.join('\n'))
      }
    } else {
      // grouping: 'one' — single file with all schemas
      const needed = new Set<string>()
      const lines: string[] = []
      const typeLines: string[] = []

      // When dtFileName === schFileName, DataType constants belong inline in this file
      const dtInline = dtGrouping === 'one' && dtFileName === schFileName

      // Track DataType names used (to build cross-file import when dtFileName ≠ schFileName)
      const usedDataTypes = new Set<string>()

      // Inline DataType declarations (when same file)
      if (dtInline) {
        result.delete(`${dtFileName}.ts`)
        for (const dt of objectModel.dataTypes) {
          const { expr, imps } = this.dataTypeExpr(dt)
          imps.forEach(i => needed.add(i))
          if (dt.description) lines.push(`/** ${dt.description} */`)
          lines.push(`export const ${dt.name} = ${expr};`)
        }
        if (objectModel.dataTypes.length > 0) lines.push('')
      }

      for (const typeName of sorted) {
        const mapping = persistenceModel.mappings[typeName]
        if (!mapping) continue

        const props: string[] = []
        for (const field of mapping.fields) {
          const { expr, imps } = this.fieldExpr(field, dataTypeNames)
          imps.forEach(i => needed.add(i))
          if (!dtInline && field.dataTypeName && dataTypeNames.has(field.dataTypeName)) {
            usedDataTypes.add(field.dataTypeName)
          }
          props.push(`  ${field.property}: ${expr},`)
        }
        for (const rel of mapping.relations) {
          if (!persistenceModel.mappings[rel.target]) continue
          if (rel.relationType === 'one_to_many' || rel.relationType === 'many_to_many') {
            needed.add('array')
            props.push(`  ${rel.property}: array(${rel.target}Schema),`)
          }
        }

        needed.add('object')
        const objType2 = typeByName.get(typeName)
        if (objType2?.description) lines.push(`/** ${objType2.description} */`)
        lines.push(`export const ${typeName}Schema = object({\n${props.join('\n')}\n}, '${typeName}');`)
        lines.push('')
        typeLines.push(`export type ${typeName}Type = InferObject<typeof ${typeName}Schema>`)
      }

      const extraImports: string[] = []

      if (!dtInline && dtGrouping === 'one' && usedDataTypes.size > 0) {
        const schemaFilePath = [...schSubParts, schFileName].filter(Boolean).join('/')
        const relPath = relativeImport(`${schemaFilePath}.ts`, dtFileName)
        extraImports.push(`import { ${[...usedDataTypes].sort().join(', ')} } from '${relPath}';`)
      }

      const content = this.withImports(needed, [...extraImports, ...(extraImports.length ? [''] : []), ...lines, ...typeLines])
      result.set(`${schFileName}.ts`, content)
    }

    return result
  }

  private withImports(needed: Set<string>, bodyLines: string[]): string {
    const valueImports = [...needed].filter(i => i !== 'InferObject').sort()
    const header = [
      `import { ${valueImports.join(', ')} } from '@svx/common';`,
      `import type { InferObject } from '@svx/common';`,
      '',
    ]
    return [...header, ...bodyLines].join('\n')
  }

  private dataTypeExpr(dt: DataType): { expr: string; imps: string[] } {
    const imps: string[] = []
    let base = ''
    switch (dt.baseType) {
      case 'integer':
        imps.push('integer'); base = 'integer()'
        if (dt.tags['min']) base += `.min(${dt.tags['min']})`
        if (dt.tags['max']) base += `.max(${dt.tags['max']})`
        break
      case 'long':
        imps.push('long'); base = 'long()'
        if (dt.tags['min']) base += `.min(${dt.tags['min']})`
        if (dt.tags['max']) base += `.max(${dt.tags['max']})`
        break
      case 'decimal':
        imps.push('number'); base = 'number()'
        if (dt.tags['precision']) base += `.precision(${dt.tags['precision']})`
        if (dt.tags['scale']) base += `.scale(${dt.tags['scale']})`
        break
      case 'boolean':
        imps.push('boolean'); base = 'boolean()'
        break
      default:
        imps.push('string'); base = 'string()'
        if (dt.tags['email'] === 'true') base += '.email()'
        const minLen = dt.tags['minLength'] ?? dt.tags['min']
        if (minLen) base += `.min(${minLen})`
        const maxLen = dt.tags['maxLength'] ?? dt.tags['max']
        if (maxLen) base += `.max(${maxLen})`
    }
    return { expr: base, imps }
  }

  private fieldExpr(field: FieldMapping, dataTypeNames: Set<string>): { expr: string; imps: string[] } {
    const imps: string[] = []
    let base = ''
    if (field.dataTypeName && dataTypeNames.has(field.dataTypeName)) {
      base = field.dataTypeName
    } else {
      switch (field.logicalType) {
        case 'integer':  imps.push('integer'); base = 'integer()'; break
        case 'long':     imps.push('long');    base = 'long()';    break
        case 'decimal':
          imps.push('number'); base = 'number()'
          if (field.precision !== undefined) base += `.precision(${field.precision})`
          if (field.scale !== undefined)     base += `.scale(${field.scale})`
          break
        case 'boolean':  imps.push('boolean'); base = 'boolean()'; break
        case 'json':     imps.push('object');  base = 'object({})'; break
        default:
          imps.push('string'); base = 'string()'
          if (field.length) base += `.max(${field.length})`
      }
    }
    if (field.nullable) {
      imps.push('optional')
      return { expr: `optional(${base})`, imps }
    }
    return { expr: base, imps }
  }

  private topologicalSort(typeNames: string[], persistenceModel: PersistenceModel): string[] {
    const nameSet = new Set(typeNames)
    const visited = new Set<string>()
    const inProgress = new Set<string>()
    const result: string[] = []
    const visit = (name: string) => {
      if (visited.has(name) || inProgress.has(name)) return
      inProgress.add(name)
      const mapping = persistenceModel.mappings[name]
      if (mapping) {
        for (const rel of mapping.relations) {
          if (nameSet.has(rel.target) && (rel.relationType === 'one_to_many' || rel.relationType === 'many_to_many'))
            visit(rel.target)
        }
      }
      inProgress.delete(name)
      visited.add(name)
      result.push(name)
    }
    for (const name of typeNames) visit(name)
    return result
  }
}

/**
 * Compute a relative import path from one file to another (both relative to the same root).
 * Strips .ts extension. Result always starts with ./ or ../.
 * Example: relativeImport('user/user.schema.ts', 'address/address.schema')
 *        → '../address/address.schema'
 */
export function relativeImport(fromFile: string, toPath: string): string {
  const fromDir = posixDirname(fromFile)
  const rel = posixRelative(fromDir, toPath)
  return rel.startsWith('.') ? rel : `./${rel}`
}
