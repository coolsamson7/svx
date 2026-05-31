/**
 * Default naming strategy — driven by NamingConfig.
 */

import type { NamingConfig } from '../config/types.js'
import type { NamingStrategy, NamingTransform } from './strategy.js'
import { TransformPipeline } from './strategy.js'
import { RemoveSuffixTransform } from './strategies/remove-suffix.js'
import { SnakeCaseTransform } from './strategies/snake-case.js'
import { UpperSnakeCaseTransform } from './strategies/upper-snake-case.js'
import { CamelCaseTransform, LowerCaseTransform, UpperCaseTransform } from './strategies/camel-case.js'
import { KebabCaseTransform } from './strategies/kebab-case.js'
import { PluralizeTransform } from './strategies/pluralize.js'
import { PrefixSuffixTransform } from './strategies/prefix-suffix.js'
import { IdentifierShortener } from '../identifiers/shortener.js'
import { specToTransform } from './name-spec.js'

/** Build a casing transform from a config string */
function buildCaseTransform(
  casing: string | undefined,
): NamingTransform {
  switch (casing) {
    case 'upper_snake': return new UpperSnakeCaseTransform()
    case 'lower_snake': return new SnakeCaseTransform()
    case 'upper':       return new UpperCaseTransform()
    case 'lower':       return new LowerCaseTransform()
    case 'camel':       return new CamelCaseTransform()
    default:            return new SnakeCaseTransform()
  }
}

/**
 * Naming strategy implementation that delegates to a pipeline of transforms
 * configured from a NamingConfig.
 */
export class DefaultNamingStrategy implements NamingStrategy {
  private readonly tableTransform: NamingTransform
  private readonly columnTransform: NamingTransform
  private readonly tsFileTransform: NamingTransform
  private readonly entityTransform: NamingTransform
  private readonly fkColumnTransform: NamingTransform
  private readonly fkPattern: string
  private readonly fkMaxLength: number
  private readonly jtPrefix: string
  private readonly jtSeparator: string
  private readonly shortener: IdentifierShortener

  constructor(config: NamingConfig) {
    const tc = config.tables

    let tableTransform: NamingTransform
    if (tc.spec) {
      tableTransform = specToTransform(tc.spec)
    } else {
      const tableSteps: NamingTransform[] = []
      if (tc.removeSuffixes?.length) tableSteps.push(new RemoveSuffixTransform(tc.removeSuffixes))
      if (tc.pluralize) tableSteps.push(new PluralizeTransform())
      tableSteps.push(buildCaseTransform(tc.case))
      if (tc.prefix || tc.suffix) tableSteps.push(new PrefixSuffixTransform(tc.prefix ?? '', tc.suffix ?? ''))
      tableTransform = new TransformPipeline(tableSteps)
    }
    this.tableTransform = tableTransform

    const cc = config.columns
    let columnTransform: NamingTransform
    if (cc.spec) {
      columnTransform = specToTransform(cc.spec)
    } else {
      const columnSteps: NamingTransform[] = [buildCaseTransform(cc.case)]
      if (cc.prefix) columnSteps.unshift(new PrefixSuffixTransform(cc.prefix))
      columnTransform = new TransformPipeline(columnSteps)
    }
    this.columnTransform = columnTransform

    const tf = config.tsFiles ?? {}
    let tsFileTransform: NamingTransform
    if (tf.spec) {
      tsFileTransform = specToTransform(tf.spec)
    } else {
      const tsSteps: NamingTransform[] = []
      if (tf.removeSuffixes?.length) tsSteps.push(new RemoveSuffixTransform(tf.removeSuffixes))
      tsSteps.push(this.buildTsCaseTransform(tf.case))
      tsFileTransform = new TransformPipeline(tsSteps)
    }
    this.tsFileTransform = tsFileTransform

    const ec = config.entities ?? {}
    this.entityTransform = ec.spec ? specToTransform(ec.spec) : { apply: (n: string) => n }

    const fkc = config.foreignKeyColumns ?? {}
    this.fkColumnTransform = specToTransform(fkc.spec ?? '=SNAKE +_ID')

    const fk = config.foreignKeys
    // pattern wins; fall back to building one from the legacy prefix field
    this.fkPattern = fk.pattern ?? `${fk.prefix ?? 'OR_'}{table}_{target}`
    this.fkMaxLength = fk.maxLength ?? 63
    this.jtPrefix = config.joinTables.prefix ?? ''
    this.jtSeparator = config.joinTables.separator ?? '_'
    this.shortener = new IdentifierShortener(this.fkMaxLength)
  }

  tableName(typeName: string): string {
    return this.tableTransform.apply(typeName)
  }

  columnName(propertyName: string): string {
    return this.columnTransform.apply(propertyName)
  }

  tsFileStem(name: string): string {
    return this.tsFileTransform.apply(name)
  }

  entityName(typeName: string): string {
    return this.entityTransform.apply(typeName)
  }

  fkColumnName(relName: string): string {
    return this.fkColumnTransform.apply(relName)
  }

  foreignKeyName(table: string, referencedTable: string, column: string): string {
    const raw = this.fkPattern
      .replace('{table}', table)
      .replace('{target}', referencedTable)
      .replace('{column}', column)
    return this.shortener.shorten(raw)
  }

  joinTableName(ownerTable: string, inverseTable: string): string {
    const raw = `${this.jtPrefix}${ownerTable}${this.jtSeparator}${inverseTable}`
    return this.shortener.shorten(raw)
  }

  constraintName(table: string, columns: string[]): string {
    const raw = `UQ_${table}_${columns.join('_')}`
    return this.shortener.shorten(raw)
  }

  private buildTsCaseTransform(casing: string | undefined): NamingTransform {
    switch (casing) {
      case 'lower_snake': return new SnakeCaseTransform()
      case 'camel':       return new CamelCaseTransform()
      case 'pascal':      return new UpperCaseTransform()
      default:            return new KebabCaseTransform()
    }
  }
}
