/**
 * Compiler configuration types.
 */

/** How concrete classes in an inheritance hierarchy are mapped to tables */
export type InheritanceStrategy = 'table_per_class' | 'single_table' | 'joined'

/** Override or supplement DataType definitions from the XMI */
export interface DataTypeOverride {
  /** Override the base primitive type (string | integer | decimal | boolean | uuid | datetime) */
  baseType?: string
  /** Override or add tagged values (maxLength, precision, scale, email, …) */
  tags?: Record<string, string>
}

/** Configuration for table name generation */
export interface TableNamingConfig {
  /** Compact spec string, e.g. "-Entity =snake =plural". Takes priority over individual fields. */
  spec?: string
  removeSuffixes?: string[]
  case?: 'upper_snake' | 'lower_snake' | 'upper' | 'lower' | 'camel'
  prefix?: string
  suffix?: string
  pluralize?: boolean
}

/** Configuration for column name generation */
export interface ColumnNamingConfig {
  /** Compact spec string, e.g. "=snake". Takes priority over individual fields. */
  spec?: string
  case?: 'upper_snake' | 'lower_snake' | 'camel'
  prefix?: string
}

/** Configuration for foreign key constraint names */
export interface ForeignKeyNamingConfig {
  /**
   * Template for the constraint name. Placeholders: {table}, {target}, {column}.
   * Example: 'OR_{table}_{target}' → OR_USER_CONTACT_INFO
   * Takes precedence over prefix if both are set.
   */
  pattern?: string
  /** Legacy: plain prefix prepended before {table}_{target}. Ignored when pattern is set. */
  prefix?: string
  /** @internal set by pipeline from dialect — do not configure manually */
  maxLength?: number
}

/** Configuration for join table names */
export interface JoinTableNamingConfig {
  prefix?: string
  separator?: string
}

/** Configuration for TypeScript entity class names */
export interface EntityNamingConfig {
  /** Compact spec string, e.g. "+Entity" or "-VO +Entity =pascal". Default: identity (name unchanged). */
  spec?: string
}

/** Configuration for FK column names (the column that holds the foreign key value) */
export interface ForeignKeyColumnNamingConfig {
  /**
   * Compact spec applied to the relation property name (e.g. "contactInfo").
   * Example: "=SNAKE +_ID" → CONTACT_INFO_ID, "^OR_ =SNAKE +_ID" → OR_CONTACT_INFO_ID.
   * Default: "=SNAKE +_ID"
   */
  spec?: string
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
  /** Compact spec string for file stem transform, e.g. "-Entity =kebab". Takes priority over case/removeSuffixes. */
  spec?: string
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
  /** Stem suffix for entity TypeScript files. Default: 'entity' → user.entity.ts. '' → user.ts */
  entityFileSuffix?: string
  /** Subdirectory within the entities output dir. Default: '' */
  entitySubDir?: string
  /** Stem suffix for schema TypeScript files. Default: 'schema' → user.schema.ts. '' → user.ts */
  schemaFileSuffix?: string
  /** Subdirectory within the schemas output dir. Default: '' */
  schemaSubDir?: string
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
  /** FK column naming (the value column, e.g. CONTACT_INFO_ID). Default spec: "=SNAKE +_ID" */
  foreignKeyColumns?: ForeignKeyColumnNamingConfig
  joinTables: JoinTableNamingConfig
  /** TypeScript entity class naming. Default: identity (name unchanged). */
  entities?: EntityNamingConfig
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
  /** Emit ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY statements. Default: true */
  emitForeignKeys?: boolean
  /** How abstract-class hierarchies map to tables. Default: table_per_class */
  inheritanceStrategy?: InheritanceStrategy
  /** Override or add DataType definitions without editing the XMI */
  dataTypeOverrides?: Record<string, DataTypeOverride>
}
