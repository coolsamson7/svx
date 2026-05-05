
/**
 * A Property is able to read and write values given an instance.
 */
export abstract class Property<CTX = any> {
  abstract get(instance: any, context: CTX): any;

  abstract set(instance: any, value: any, context: CTX): void;
}

/**
 * An Operation contains a source and a target Property.
 * It can transfer values between them.
 */
export class Operation<CTX=any> {
  source: Property<CTX>;
  target: Property<CTX>;

  constructor(source: Property<CTX>, target: Property<CTX>) {
    this.source = source;
    this.target = target;
  }

  setTarget(from: any, to: any, context: CTX): void {
    const value = this.source.get(from, context);
    this.target.set(to, value, context);
  }

  setSource(to: any, from: any, context: CTX): void {
    const value = this.target.get(to, context);
    this.source.set(from, value, context);
  }
}

/**
 * A Transformer applies a list of operations to transform objects.
 */
export class Transformer<CTX = any> {
  operations: Operation<CTX>[];

  constructor(operations: Operation<CTX>[]) {
    this.operations = operations;
  }

  transformTarget(source: any, target: any, context: CTX): void {
    for (const op of this.operations) {
      op.setTarget(source, target, context);
    }
  }
}
