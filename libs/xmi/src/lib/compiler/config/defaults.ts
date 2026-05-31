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
    pattern: 'OR_{table}_{target}',
  },
  foreignKeyColumns: {
    spec: '=SNAKE OR_{name}_ID',
  },
  joinTables: {
    prefix: '',
    separator: '_',
  },
  entities: {
    spec: '',
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
