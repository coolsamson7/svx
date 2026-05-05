export type Primitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  | Date;

/* =========================================================
 * TYPE LEVEL PATHS (compile-time DSL)
 * ========================================================= */

/**
 * Converts a nested object type into dot-notation paths.
 *
 * Example:
 * {
 *   address: {
 *     city: string
 *   }
 * }
 *
 * → "address" | "address.city"
 */
export type Path<T> =
  T extends Primitive
    ? never
    : {
        [K in keyof T & string]:
          T[K] extends Primitive
            ? K
            : K | `${K}.${Path<T[K]>}`
      }[keyof T & string];

/* =========================================================
 * OPTIONAL: FLATTEN PATHS (used by matching())
 * ========================================================= */

/**
 * Extracts all dot-paths from a type-like object shape at runtime.
 * Used for matching() auto-mapping.
 */
export function getPaths(obj: any, prefix = ""): string[] {
  const result: string[] = [];

  if (!obj || typeof obj !== "object") return result;

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const path = prefix ? `${prefix}.${key}` : key;

    result.push(path);

    if (value && typeof value === "object" && !Array.isArray(value)) {
      result.push(...getPaths(value, path));
    }
  }

  return result;
}
