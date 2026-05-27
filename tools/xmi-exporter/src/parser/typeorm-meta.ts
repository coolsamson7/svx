import { Multiplicity } from '../model';

export type RelationKind = 'OneToMany' | 'ManyToOne' | 'OneToOne' | 'ManyToMany';

export interface RelationMeta {
  kind: RelationKind;
  propertyName: string;
  targetClassName: string;
  cascade: boolean;
  sourceMult: Multiplicity;
  targetMult: Multiplicity;
}

/**
 * Maps TypeORM relation decorator name to source/target multiplicities.
 * Convention: "source" is the class that carries this decorator.
 */
export function relationMultiplicities(
  kind: RelationKind,
): { sourceMult: Multiplicity; targetMult: Multiplicity } {
  switch (kind) {
    case 'OneToMany':
      return { sourceMult: '1', targetMult: '0..*' };
    case 'ManyToOne':
      return { sourceMult: '0..*', targetMult: '1' };
    case 'OneToOne':
      return { sourceMult: '0..1', targetMult: '0..1' };
    case 'ManyToMany':
      return { sourceMult: '0..*', targetMult: '0..*' };
  }
}

/**
 * Maps a TypeScript primitive type name to a UML primitive name.
 */
export function tsPrimToUml(tsType: string): string {
  switch (tsType.toLowerCase()) {
    case 'string': return 'String';
    case 'number': return 'Integer';
    case 'boolean': return 'Boolean';
    case 'date': return 'DateTime';
    default: return 'String';
  }
}

/**
 * Maps a valibot/schema function name to a UML primitive name.
 */
export function schemaFnToUml(fnName: string): string {
  switch (fnName.toLowerCase()) {
    case 'string': return 'String';
    case 'number':
    case 'int':
    case 'integer': return 'Integer';
    case 'boolean': return 'Boolean';
    case 'date': return 'DateTime';
    default: return 'String';
  }
}
