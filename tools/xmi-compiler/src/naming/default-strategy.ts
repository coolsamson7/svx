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
  private readonly tableTransform: TransformPipeline
  private readonly columnTransform: TransformPipeline
  private readonly tsFileTransform: TransformPipeline
  private readonly fkPrefix: string
  private readonly fkMaxLength: number
  private readonly jtPrefix: string
  private readonly jtSeparator: string
  private readonly shortener: IdentifierShortener

  constructor(config: NamingConfig) {
    const tc = config.tables

    const tableSteps: NamingTransform[] = []
    if (tc.removeSuffixes?.length) tableSteps.push(new RemoveSuffixTransform(tc.removeSuffixes))
    if (tc.pluralize) tableSteps.push(new PluralizeTransform())
    tableSteps.push(buildCaseTransform(tc.case))
    if (tc.prefix || tc.suffix) tableSteps.push(new PrefixSuffixTransform(tc.prefix ?? '', tc.suffix ?? ''))
    this.tableTransform = new TransformPipeline(tableSteps)

    const cc = config.columns
    const columnSteps: NamingTransform[] = [buildCaseTransform(cc.case)]
    if (cc.prefix) columnSteps.unshift(new PrefixSuffixTransform(cc.prefix))
    this.columnTransform = new TransformPipeline(columnSteps)

    const tf = config.tsFiles ?? {}
    const tsSteps: NamingTransform[] = []
    if (tf.removeSuffixes?.length) tsSteps.push(new RemoveSuffixTransform(tf.removeSuffixes))
    tsSteps.push(this.buildTsCaseTransform(tf.case))
    this.tsFileTransform = new TransformPipeline(tsSteps)

    this.fkPrefix = config.foreignKeys.prefix ?? 'FK_'
    this.fkMaxLength = config.foreignKeys.maxLength ?? 63
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

  foreignKeyName(table: string, referencedTable: string, _column: string): string {
    const raw = `${this.fkPrefix}${table}_${referencedTable}`
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
