/**
 * In-memory (browser-safe) XMI compilation pipeline.
 * Takes raw XMI string and config; returns generated file content as Maps.
 * No file I/O — use tools/xmi-compiler/src/pipeline.ts for the CLI.
 */

import type { NamingConfig, OutputDirsConfig } from './config/types.js'
import { DEFAULT_NAMING_CONFIG, DEFAULT_OUTPUT_DIRS } from './config/defaults.js'
import { XmiParser } from './xmi/parser/xmi-parser.js'
import { XmiToObjectTransformer } from './transformers/xmi-to-object/transformer.js'
import { ObjectToMappingTransformer } from './transformers/object-to-mapping/transformer.js'
import { MappingToSchemaTransformer } from './transformers/mapping-to-schema/transformer.js'
import { SchemaToDialectTransformer } from './transformers/schema-to-dialect/transformer.js'
import { DefaultNamingStrategy } from './naming/default-strategy.js'
import { PostgresDialectMapper } from './dialects/postgres/dialect.js'
import { OracleDialectMapper } from './dialects/oracle/dialect.js'
import { MySqlDialectMapper } from './dialects/mysql/dialect.js'
import type { DialectMapper } from './model/dialect/types.js'
import { YamlGenerator } from './generators/yaml/generator.js'
import { JsonGenerator } from './generators/json/generator.js'
import { PostgresSqlGenerator } from './generators/sql/postgres/generator.js'
import { OracleSqlGenerator } from './generators/sql/oracle/generator.js'
import { MySqlSqlGenerator } from './generators/sql/mysql/generator.js'
import { TypeOrmGenerator } from './generators/orm/typeorm/generator.js'
import { SchemaMapperGenerator } from './generators/schema/generator.js'

export type GeneratorName = 'yaml' | 'json' | 'sql' | 'schema' | 'typeorm'

export interface CompileOptions {
  dialect?: 'postgres' | 'oracle' | 'mysql'
  generators?: GeneratorName[]
  naming?: NamingConfig
  outputDirs?: OutputDirsConfig
  /** Emit ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY statements. Default: true */
  emitForeignKeys?: boolean
  /** How abstract-class hierarchies map to tables. Default: table_per_class */
  inheritanceStrategy?: 'table_per_class' | 'single_table' | 'joined'
  /** Override or add DataType definitions without editing the XMI */
  dataTypeOverrides?: Record<string, { baseType?: string; tags?: Record<string, string> }>
}

export interface CompileResult {
  yaml?: string
  json?: string
  sql?: string
  /** relativeFilePath (from schemasDir) → content */
  schemas?: Map<string, string>
  /** relativeFilePath (from entitiesDir) → content */
  entities?: Map<string, string>
}

export function compileXmi(xmiString: string, options: CompileOptions = {}): CompileResult {
  const {
    dialect = 'postgres',
    generators = ['yaml', 'json', 'sql', 'schema', 'typeorm'],
    naming = DEFAULT_NAMING_CONFIG,
    outputDirs,
    emitForeignKeys = true,
    inheritanceStrategy,
    dataTypeOverrides,
  } = options

  // Dialect determines the max identifier length — not user-configurable
  const dialectMapper = createDialectMapper(dialect)
  const resolvedNaming: NamingConfig = {
    ...naming,
    foreignKeys: { ...naming.foreignKeys, maxLength: dialectMapper.config.maxIdentifierLength },
  }
  const namingStrategy = new DefaultNamingStrategy(resolvedNaming)

  const parser = new XmiParser()
  const parsed = parser.parseString(xmiString)

  const objectModel = new XmiToObjectTransformer().transform(parsed)
  const persistenceModel = new ObjectToMappingTransformer(namingStrategy, { inheritanceStrategy, dataTypeOverrides }).transform(objectModel)
  const abstractSchema = new MappingToSchemaTransformer(namingStrategy).transform(persistenceModel)
  const dialectSchema = new SchemaToDialectTransformer().transform(abstractSchema, dialectMapper)

  const result: CompileResult = {}

  for (const gen of generators) {
    switch (gen) {
      case 'yaml':
        result.yaml = new YamlGenerator().generate({ objectModel, persistenceModel, schema: dialectSchema })
        break
      case 'json':
        result.json = new JsonGenerator().generate({ objectModel, persistenceModel, schema: dialectSchema })
        break
      case 'sql':
        result.sql = createSqlGenerator(dialect).generate(dialectSchema, dialectMapper, { emitForeignKeys })
        break
      case 'schema': {
        result.schemas = new SchemaMapperGenerator().generate(objectModel, persistenceModel, {
          naming: namingStrategy,
          tsFiles: naming.tsFiles ?? {},
        })
        break
      }
      case 'typeorm': {
        const entitiesDir = outputDirs?.entities ?? DEFAULT_OUTPUT_DIRS.entities!
        const schemasDir  = outputDirs?.schemas  ?? DEFAULT_OUTPUT_DIRS.schemas!
        result.entities = new TypeOrmGenerator().generate(objectModel, persistenceModel, {
          naming: namingStrategy,
          tsFiles: naming.tsFiles ?? {},
          entitiesDir,
          schemasDir,
        })
        break
      }
    }
  }

  return result
}

function createDialectMapper(dialect: string): DialectMapper {
  switch (dialect) {
    case 'oracle': return new OracleDialectMapper()
    case 'mysql':  return new MySqlDialectMapper()
    default:       return new PostgresDialectMapper()
  }
}

function createSqlGenerator(dialect: string) {
  switch (dialect) {
    case 'oracle': return new OracleSqlGenerator()
    case 'mysql':  return new MySqlSqlGenerator()
    default:       return new PostgresSqlGenerator()
  }
}
