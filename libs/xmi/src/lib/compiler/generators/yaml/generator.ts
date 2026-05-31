/**
 * YAML generator — serialises any metadata object to a YAML string.
 */

import yaml from 'js-yaml'

/** Generic generator interface */
export interface Generator<T> {
  generate(data: T): string
}

/** Serialises any value to YAML using js-yaml, omitting undefined fields. */
export class YamlGenerator<T> implements Generator<T> {
  generate(data: T): string {
    // Strip undefined values so js-yaml doesn't emit the !!js/undefined tag
    const cleaned = JSON.parse(JSON.stringify(data, (_k, v) => v === undefined ? undefined : v))
    return yaml.dump(cleaned, { lineWidth: 120, sortKeys: false })
  }
}
