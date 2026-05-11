import { Hashable, HashMap } from "./hashmap";

export class HashSet<T extends Hashable> {
  private map: HashMap<T, boolean>;

  constructor() {
    this.map = new HashMap<T, boolean>();
  }

  add(value: T): this {
    this.map.set(value, true);
    return this;
  }

  has(value: T): boolean {
    return this.map.get(value) !== undefined;
  }

  delete(value: T): boolean {
    return this.map.delete(value);
  }

  //TODO clear(): void {
  //  this.map.clear();
  //}

  get size(): number {
    return this.map.size;
  }

  /*values(): Iterable<T> {
    return this.map.keys();
  }

  forEach(fn: (v: T) => void) {
    for (const v of this.map.keys()) {
      fn(v);
    }
  }*/
}
