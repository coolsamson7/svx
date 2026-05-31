/**
 * String manipulation utilities for naming and identifier handling.
 */

/**
 * Convert a camelCase or PascalCase string to snake_case.
 * Handles consecutive uppercase letters (e.g. "HTTPSRequest" → "https_request").
 */
export function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .toLowerCase()
}

/**
 * Convert a camelCase or PascalCase string to UPPER_SNAKE_CASE.
 */
export function toUpperSnakeCase(name: string): string {
  return toSnakeCase(name).toUpperCase()
}

/**
 * Convert a camelCase or PascalCase string to kebab-case.
 * UserEntity → user-entity, SmallString → small-string
 */
export function toKebabCase(name: string): string {
  return toSnakeCase(name).replace(/_/g, '-')
}

/**
 * Convert a snake_case or UPPER_SNAKE_CASE string to camelCase.
 */
export function toCamelCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())
}

/**
 * Convert a snake_case or camelCase string to PascalCase.
 */
export function toPascalCase(name: string): string {
  const camel = toCamelCase(name)
  return camel.charAt(0).toUpperCase() + camel.slice(1)
}

/**
 * Remove one of the known suffixes from a string (case-sensitive).
 * Only the longest matching suffix is removed.
 */
export function removeSuffix(name: string, suffixes: string[]): string {
  const sorted = [...suffixes].sort((a, b) => b.length - a.length)
  for (const suffix of sorted) {
    if (name.endsWith(suffix) && name.length > suffix.length) {
      return name.slice(0, -suffix.length)
    }
  }
  return name
}

/**
 * Very simple English pluraliser.
 * Handles the most common irregular plurals and standard -s/-es rules.
 */
export function pluralize(word: string): string {
  const irregulars: Record<string, string> = {
    person: 'people',
    child: 'children',
    man: 'men',
    woman: 'women',
    mouse: 'mice',
    goose: 'geese',
    tooth: 'teeth',
    foot: 'feet',
    ox: 'oxen',
    leaf: 'leaves',
    knife: 'knives',
    life: 'lives',
    wife: 'wives',
    half: 'halves',
    shelf: 'shelves',
    wolf: 'wolves',
    loaf: 'loaves',
    potato: 'potatoes',
    tomato: 'tomatoes',
    cactus: 'cacti',
    focus: 'foci',
    datum: 'data',
    medium: 'media',
    analysis: 'analyses',
    crisis: 'crises',
    basis: 'bases',
    diagnosis: 'diagnoses',
    matrix: 'matrices',
    index: 'indices',
    vertex: 'vertices',
  }

  const lower = word.toLowerCase()
  if (irregulars[lower]) {
    // Preserve original casing style
    const plural = irregulars[lower]
    if (word === word.toUpperCase()) return plural.toUpperCase()
    if (word[0] === word[0].toUpperCase()) {
      return plural.charAt(0).toUpperCase() + plural.slice(1)
    }
    return plural
  }

  // Ends in s, x, z, ch, sh → add es
  if (/[sxz]$/.test(lower) || /[cs]h$/.test(lower)) {
    return word + 'es'
  }

  // Ends in consonant + y → remove y, add ies
  if (/[^aeiou]y$/i.test(lower)) {
    return word.slice(0, -1) + 'ies'
  }

  return word + 's'
}

/**
 * Compute a short, stable hex string from the input (first 5 hex chars of a simple hash).
 * Pure JS — no Node crypto required for short identifiers.
 */
export function shortHash(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i)
    hash = hash >>> 0 // keep 32-bit unsigned
  }
  return hash.toString(16).padStart(8, '0').slice(0, 5)
}
