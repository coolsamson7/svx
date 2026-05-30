/**
 * XMI Compiler — CLI entry point.
 *
 * Usage:
 *   node dist/index.js [config.yaml]
 *
 * If no config file is provided, defaults to examples/compiler.config.yaml.
 */

import { CompilerPipeline } from './pipeline.js'
import { resolve } from 'node:path'

const configPath = process.argv[2] ?? 'examples/compiler.config.yaml'

const pipeline = new CompilerPipeline()
const config = CompilerPipeline.loadConfig(resolve(configPath))

pipeline.run(config).catch((err: unknown) => {
  console.error('Compilation failed:', err)
  process.exit(1)
})

// Re-export public API
export { CompilerPipeline } from './pipeline.js'
export type { CompilerConfig, NamingConfig } from './config/types.js'
export type { ObjectModel, ObjectType, Property, Relation, EnumType } from './model/object/types.js'
export type { PersistenceModel, TypeMapping } from './model/mapping/types.js'
export type { AbstractSchema, SchemaTable } from './model/schema/types.js'
export { XmiParser } from './xmi/parser/xmi-parser.js'
export { XmiToObjectTransformer } from './transformers/xmi-to-object/transformer.js'
export { ObjectToMappingTransformer } from './transformers/object-to-mapping/transformer.js'
export { MappingToSchemaTransformer } from './transformers/mapping-to-schema/transformer.js'
export { SchemaToDialectTransformer } from './transformers/schema-to-dialect/transformer.js'
export { TypeOrmGenerator } from './generators/orm/typeorm/generator.js'
export { SchemaMapperGenerator } from './generators/schema/generator.js'
export { DefaultNamingStrategy } from './naming/default-strategy.js'
export { IdentifierCompressionPipeline } from './identifiers/compression-pipeline.js'
export { IdentifierShortener } from './identifiers/shortener.js'
