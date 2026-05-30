/**
 * YAML generator — serialises any metadata object to a YAML string.
 */

import yaml from 'js-yaml'

/** Generic generator interface */
export interface Generator<T> {
  generate(data: T): string
}

/** Serialises any value to YAML using js-yaml */
export class YamlGenerator<T> implements Generator<T> {
  generate(data: T): string {
    return yaml.dump(data, { lineWidth: 120, sortKeys: false })
  }
}
