/**
 * Main compiler pipeline orchestrator.
 * Runs the full XMI → TypeORM pipeline based on a CompilerConfig.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import yaml from 'js-yaml'

import type { CompilerConfig } from './config/types.js'
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

/**
 * The main compiler pipeline.
 * Each stage is independently testable; the pipeline just orchestrates them in order.
 */
export class CompilerPipeline {
  async run(config: CompilerConfig): Promise<void> {
    const naming = new DefaultNamingStrategy(config.naming ?? DEFAULT_NAMING_CONFIG)

    // Stage 1: Parse XMI → ObjectModel
    const parser = new XmiParser()
    const parsed = parser.parseFile(config.xmiPath)

    const xmiTransformer = new XmiToObjectTransformer()
    const objectModel = xmiTransformer.transform(parsed)

    // Stage 2: ObjectModel → PersistenceModel
    const mappingTransformer = new ObjectToMappingTransformer(naming)
    const persistenceModel = mappingTransformer.transform(objectModel)

    // Stage 3: PersistenceModel → AbstractSchema
    const schemaTransformer = new MappingToSchemaTransformer(naming)
    const abstractSchema = schemaTransformer.transform(persistenceModel)

    // Stage 4: AbstractSchema → dialect schema
    const dialectMapper = this.createDialectMapper(config.dialect)
    const dialectTransformer = new SchemaToDialectTransformer()
    const dialectSchema = dialectTransformer.transform(abstractSchema, dialectMapper)

    // Stage 5: Run generators
    mkdirSync(config.outputDir, { recursive: true })

    for (const gen of config.generators) {
      switch (gen) {
        case 'yaml': {
          const yamlGen = new YamlGenerator()
          const content = yamlGen.generate({
            objectModel,
            persistenceModel,
            schema: dialectSchema,
          })
          writeFileSync(join(config.outputDir, 'schema.yaml'), content, 'utf8')
          console.log(`[yaml] Written to ${config.outputDir}/schema.yaml`)
          break
        }
        case 'json': {
          const jsonGen = new JsonGenerator()
          const content = jsonGen.generate({
            objectModel,
            persistenceModel,
            schema: dialectSchema,
          })
          writeFileSync(join(config.outputDir, 'schema.json'), content, 'utf8')
          console.log(`[json] Written to ${config.outputDir}/schema.json`)
          break
        }
        case 'sql': {
          const sqlGen = this.createSqlGenerator(config.dialect)
          const ddl = sqlGen.generate(dialectSchema, dialectMapper)
          writeFileSync(join(config.outputDir, 'schema.sql'), ddl, 'utf8')
          console.log(`[sql] Written to ${config.outputDir}/schema.sql`)
          break
        }
        case 'typeorm': {
          const entitiesDir = config.outputDirs?.entities ?? DEFAULT_OUTPUT_DIRS.entities!
          const schemasDir  = config.outputDirs?.schemas  ?? DEFAULT_OUTPUT_DIRS.schemas!
          const ormGen = new TypeOrmGenerator()
          const entities = ormGen.generate(objectModel, persistenceModel, {
            naming,
            tsFiles: config.naming.tsFiles ?? {},
            entitiesDir,
            schemasDir,
          })
          const ormOutDir = join(config.outputDir, entitiesDir)
          for (const [relPath, source] of entities) {
            const file = join(ormOutDir, relPath)
            mkdirSync(join(file, '..'), { recursive: true })
            writeFileSync(file, source, 'utf8')
            console.log(`[typeorm] Written ${relPath}`)
          }
          break
        }
        case 'schema': {
          const schemasDir = config.outputDirs?.schemas ?? DEFAULT_OUTPUT_DIRS.schemas!
          const schemaGen = new SchemaMapperGenerator()
          const files = schemaGen.generate(objectModel, persistenceModel, {
            naming,
            tsFiles: config.naming.tsFiles ?? {},
          })
          const schOutDir = join(config.outputDir, schemasDir)
          for (const [relPath, content] of files) {
            const file = join(schOutDir, relPath)
            mkdirSync(join(file, '..'), { recursive: true })
            writeFileSync(file, content, 'utf8')
            console.log(`[schema] Written ${relPath}`)
          }
          break
        }
      }
    }

    console.log('Compilation complete.')
  }

  /** Load a CompilerConfig from a YAML file */
  static loadConfig(configPath: string): CompilerConfig {
    const raw = readFileSync(configPath, 'utf8')
    return yaml.load(raw) as CompilerConfig
  }

  private createDialectMapper(dialect: string): DialectMapper {
    switch (dialect) {
      case 'postgres': return new PostgresDialectMapper()
      case 'oracle':   return new OracleDialectMapper()
      case 'mysql':    return new MySqlDialectMapper()
      default:         return new PostgresDialectMapper()
    }
  }

  private createSqlGenerator(dialect: string) {
    switch (dialect) {
      case 'postgres': return new PostgresSqlGenerator()
      case 'oracle':   return new OracleSqlGenerator()
      case 'mysql':    return new MySqlSqlGenerator()
      default:         return new PostgresSqlGenerator()
    }
  }
}
