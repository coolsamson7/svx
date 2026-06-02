/**
 * CLI pipeline — file I/O orchestration.
 * Core compilation logic lives in @svx/xmi; this file adds disk read/write.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import yaml from 'js-yaml'

import type { CompilerConfig } from '@svx/xmi'
import { DEFAULT_NAMING_CONFIG, DEFAULT_OUTPUT_DIRS } from '@svx/xmi'
import { XmiParser, XmiToObjectTransformer, ObjectToMappingTransformer,
         MappingToSchemaTransformer, SchemaToDialectTransformer,
         DefaultNamingStrategy, PostgresDialectMapper, OracleDialectMapper,
         MySqlDialectMapper, YamlGenerator, JsonGenerator,
         PostgresSqlGenerator, OracleSqlGenerator, MySqlSqlGenerator,
         TypeOrmGenerator, SchemaMapperGenerator } from '@svx/xmi'
import type { DialectMapper } from '@svx/xmi'

export class CompilerPipeline {
  async run(config: CompilerConfig): Promise<void> {
    const naming = new DefaultNamingStrategy(config.naming ?? DEFAULT_NAMING_CONFIG)

    const xmiContent = readFileSync(config.xmiPath, 'utf8')
    const parsed = new XmiParser().parseString(xmiContent)
    const objectModel = new XmiToObjectTransformer().transform(parsed)
    const persistenceModel = new ObjectToMappingTransformer(naming, {
      inheritanceStrategy: config.inheritanceStrategy,
      dataTypeOverrides: config.dataTypeOverrides,
    }).transform(objectModel)
    const abstractSchema = new MappingToSchemaTransformer(naming).transform(persistenceModel)
    const dialectMapper = this.createDialectMapper(config.dialect)
    const dialectSchema = new SchemaToDialectTransformer().transform(abstractSchema, dialectMapper)

    mkdirSync(config.outputDir, { recursive: true })

    for (const gen of config.generators) {
      switch (gen) {
        case 'yaml': {
          const content = new YamlGenerator().generate({ objectModel, persistenceModel, schema: dialectSchema })
          writeFileSync(join(config.outputDir, 'schema.yaml'), content, 'utf8')
          console.log(`[yaml] Written to ${config.outputDir}/schema.yaml`)
          break
        }
        case 'json': {
          const content = new JsonGenerator().generate({ objectModel, persistenceModel, schema: dialectSchema })
          writeFileSync(join(config.outputDir, 'schema.json'), content, 'utf8')
          console.log(`[json] Written to ${config.outputDir}/schema.json`)
          break
        }
        case 'sql': {
          const ddl = this.createSqlGenerator(config.dialect).generate(dialectSchema, dialectMapper, { emitForeignKeys: config.emitForeignKeys ?? true })
          writeFileSync(join(config.outputDir, 'schema.sql'), ddl, 'utf8')
          console.log(`[sql] Written to ${config.outputDir}/schema.sql`)
          break
        }
        case 'typeorm': {
          const entitiesDir = config.outputDirs?.entities ?? DEFAULT_OUTPUT_DIRS.entities!
          const schemasDir  = config.outputDirs?.schemas  ?? DEFAULT_OUTPUT_DIRS.schemas!
          const entities = new TypeOrmGenerator().generate(objectModel, persistenceModel, {
            naming, tsFiles: config.naming.tsFiles ?? {}, entitiesDir, schemasDir,
            fileHeader: config.fileHeader,
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
          const files = new SchemaMapperGenerator().generate(objectModel, persistenceModel, {
            naming, tsFiles: config.naming.tsFiles ?? {}, fileHeader: config.fileHeader,
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

  static loadConfig(configPath: string): CompilerConfig {
    const raw = readFileSync(configPath, 'utf8')
    return yaml.load(raw) as CompilerConfig
  }

  private createDialectMapper(dialect: string): DialectMapper {
    switch (dialect) {
      case 'oracle': return new OracleDialectMapper()
      case 'mysql':  return new MySqlDialectMapper()
      default:       return new PostgresDialectMapper()
    }
  }

  private createSqlGenerator(dialect: string) {
    switch (dialect) {
      case 'oracle': return new OracleSqlGenerator()
      case 'mysql':  return new MySqlSqlGenerator()
      default:       return new PostgresSqlGenerator()
    }
  }
}
