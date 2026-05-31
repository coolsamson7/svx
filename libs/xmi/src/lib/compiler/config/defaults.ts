/**
 * Default compiler configuration values.
 */

import type { NamingConfig, OutputDirsConfig } from './types.js'

export const DEFAULT_NAMING_CONFIG: NamingConfig = {
  tables: {
    removeSuffixes: ['Entity', 'VO', 'Dto'],
    case: 'upper_snake',
    pluralize: false,
  },
  columns: {
    case: 'upper_snake',
  },
  foreignKeys: {
    prefix: 'FK_',
    maxLength: 63,
  },
  joinTables: {
    prefix: '',
    separator: '_',
  },
  tsFiles: {
    case: 'kebab',
    removeSuffixes: ['Entity', 'VO', 'Dto'],
    dataTypeGrouping: 'one',
    dataTypeFileName: 'data-types',
    schemaGrouping: 'per-type',
  },
}

export const DEFAULT_OUTPUT_DIRS: OutputDirsConfig = {
  schemas: 'schemas',
  entities: 'entities',
}
