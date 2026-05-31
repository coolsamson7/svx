// Compiler config
export * from './config/types.js'
export * from './config/defaults.js'

// Models
export * from './model/object/types.js'
export * from './model/mapping/types.js'
export * from './model/schema/types.js'
export * from './model/dialect/types.js'

// Transformers
export { XmiToObjectTransformer } from './transformers/xmi-to-object/transformer.js'
export { ObjectToMappingTransformer } from './transformers/object-to-mapping/transformer.js'
export { MappingToSchemaTransformer } from './transformers/mapping-to-schema/transformer.js'
export { SchemaToDialectTransformer } from './transformers/schema-to-dialect/transformer.js'

// Generators
export { YamlGenerator } from './generators/yaml/generator.js'
export { JsonGenerator } from './generators/json/generator.js'
export { PostgresSqlGenerator } from './generators/sql/postgres/generator.js'
export { OracleSqlGenerator } from './generators/sql/oracle/generator.js'
export { MySqlSqlGenerator } from './generators/sql/mysql/generator.js'
export { TypeOrmGenerator } from './generators/orm/typeorm/generator.js'
export type { TypeOrmGeneratorConfig } from './generators/orm/typeorm/generator.js'
export { SchemaMapperGenerator } from './generators/schema/generator.js'
export type { SchemaGeneratorConfig } from './generators/schema/generator.js'
export { relativeImport } from './generators/schema/generator.js'

// Naming
export type { NamingStrategy } from './naming/strategy.js'
export { DefaultNamingStrategy } from './naming/default-strategy.js'
export { parseNameSpec, applyNameSpec, specToTransform } from './naming/name-spec.js'

// Identifiers
export { IdentifierShortener } from './identifiers/shortener.js'

// XMI parser (parseString is browser-safe; parseFile uses Node fs)
export { XmiParser } from './xmi/parser/xmi-parser.js'

// Dialects
export { PostgresDialectMapper } from './dialects/postgres/dialect.js'
export { OracleDialectMapper } from './dialects/oracle/dialect.js'
export { MySqlDialectMapper } from './dialects/mysql/dialect.js'

// In-memory pipeline
export { compileXmi } from './pipeline.js'
export type { CompileOptions, CompileResult, GeneratorName } from './pipeline.js'
