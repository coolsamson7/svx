/**
 * Compiler configuration types.
 */

/** Configuration for table name generation */
export interface TableNamingConfig {
  removeSuffixes?: string[]
  case?: 'upper_snake' | 'lower_snake' | 'upper' | 'lower' | 'camel'
  prefix?: string
  suffix?: string
  pluralize?: boolean
}

/** Configuration for column name generation */
export interface ColumnNamingConfig {
  case?: 'upper_snake' | 'lower_snake' | 'camel'
  prefix?: string
}

/** Configuration for foreign key constraint names */
export interface ForeignKeyNamingConfig {
  prefix?: string
  maxLength?: number
}

/** Configuration for join table names */
export interface JoinTableNamingConfig {
  prefix?: string
  separator?: string
}

/**
 * TypeScript file naming and grouping configuration.
 *
 * dataTypeGrouping:
 *   'one'      → all DataType constants in one file (dataTypeFileName, default 'data-types')
 *   'per-type' → one file per DataType (stem from tsFileStem)
 *
 * schemaGrouping:
 *   'one'      → all entity schemas in one file (schemaFileName, default 'entity-schemas')
 *   'per-type' → one file per entity schema
 */
export interface TsFileNamingConfig {
  /** Casing applied to file name stems. Default: kebab (UserEntity → user-entity) */
  case?: 'kebab' | 'lower_snake' | 'camel' | 'pascal'
  /** Suffixes stripped before casing (e.g. ['Entity'] so UserEntity → user) */
  removeSuffixes?: string[]
  /** How many files DataType constants are split across. Default: 'one' */
  dataTypeGrouping?: 'one' | 'per-type'
  /** File name stem when dataTypeGrouping is 'one'. Default: 'data-types' */
  dataTypeFileName?: string
  /** How many files entity schemas are split across. Default: 'per-type' */
  schemaGrouping?: 'one' | 'per-type'
  /** File name stem when schemaGrouping is 'one'. Default: 'entity-schemas' */
  schemaFileName?: string
}

/**
 * Sub-directory placement within outputDir.
 * Package paths (from uml:Package) are appended after these dirs.
 * Set to '' to place everything flat in outputDir.
 */
export interface OutputDirsConfig {
  /** Directory for DataType and entity schema files. Default: 'schemas' */
  schemas?: string
  /** Directory for TypeORM entity files. Default: 'entities' */
  entities?: string
}

/** Aggregated naming configuration */
export interface NamingConfig {
  tables: TableNamingConfig
  columns: ColumnNamingConfig
  foreignKeys: ForeignKeyNamingConfig
  joinTables: JoinTableNamingConfig
  /** TypeScript file naming. Default: kebab-case, one DataType file, per-type schemas */
  tsFiles?: TsFileNamingConfig
}

/** Top-level compiler configuration */
export interface CompilerConfig {
  xmiPath: string
  outputDir: string
  /** Sub-directory overrides within outputDir. Default: schemas/ and entities/ */
  outputDirs?: OutputDirsConfig
  naming: NamingConfig
  dialect: 'postgres' | 'oracle' | 'mysql'
  generators: Array<'yaml' | 'json' | 'sql' | 'typeorm' | 'schema'>
}
