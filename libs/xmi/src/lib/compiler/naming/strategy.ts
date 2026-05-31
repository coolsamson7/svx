/**
 * Naming strategy interfaces and transform pipeline.
 */

/**
 * A single, composable name transformation step.
 */
export interface NamingTransform {
  /** Apply the transform and return the result */
  apply(name: string): string
}

/**
 * Describes how identifiers at each level of the schema are named.
 */
export interface NamingStrategy {
  /** Derive a table name from a type/class name */
  tableName(typeName: string): string
  /** Derive a column name from a property name */
  columnName(propertyName: string): string
  /** Derive a TypeScript file name stem from a type/class name (no extension) */
  tsFileStem(name: string): string
  /** Derive a TypeScript entity class name from a type/class name */
  entityName(typeName: string): string
  /**
   * Derive a FK column name from a relation property name (e.g. 'contactInfo' → 'CONTACT_INFO_ID').
   * Separate from columnName() so regular and FK columns can be styled independently.
   */
  fkColumnName(relName: string): string
  /**
   * Derive a foreign key constraint name.
   * @param table - owning table name
   * @param referencedTable - referenced table name
   * @param column - FK column name
   */
  foreignKeyName(table: string, referencedTable: string, column: string): string
  /**
   * Derive a join table name for a many-to-many relation.
   * @param ownerTable - owning side table name
   * @param inverseTable - inverse side table name
   */
  joinTableName(ownerTable: string, inverseTable: string): string
  /**
   * Derive a unique constraint name.
   * @param table - table that carries the constraint
   * @param columns - columns included in the constraint
   */
  constraintName(table: string, columns: string[]): string
}

/**
 * A pipeline of NamingTransforms applied in order.
 * Use `TransformPipeline.apply(name)` to run the full chain.
 */
export class TransformPipeline implements NamingTransform {
  private readonly transforms: NamingTransform[]

  constructor(transforms: NamingTransform[]) {
    this.transforms = transforms
  }

  apply(name: string): string {
    return this.transforms.reduce((n, t) => t.apply(n), name)
  }
}
