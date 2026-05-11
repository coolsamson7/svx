/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Hashable {
  hash(): number;
  equals(other: any): boolean;
}

export class HashMap<K extends Hashable, V> {
  private buckets: Array<Array<[K, V]>>;
  private _size = 0;

  constructor(private capacity = 32) {
    this.buckets = Array.from({ length: capacity }, () => []);
  }

  clone(): HashMap<K, V> {
    const copy = new HashMap<K, V>(this.capacity);

    for (const bucket of this.buckets) {
      for (const [k, v] of bucket) {
        copy.set(k, v); // reuse same references
      }
    }

    return copy;
  }

  private index(hash: number): number {
    // ensure positive + fit into array
    return (hash & 0x7fffffff) % this.capacity;
  }

  set(key: K, value: V): void {
    const idx = this.index(key.hash());
    const bucket = this.buckets[idx];

    for (let i = 0; i < bucket.length; i++) {
      const [k] = bucket[i];
      if (k.equals(key)) {
        bucket[i][1] = value; // overwrite
        return;
      }
    }

    bucket.push([key, value]);
    this._size++;

    // optional: resize
    if (this._size / this.capacity > 0.75) {
      this.resize();
    }
  }

  get(key: K): V | undefined {
    const idx = this.index(key.hash());
    const bucket = this.buckets[idx];

    for (const [k, v] of bucket) {
      if (k.equals(key)) return v;
    }

    return undefined;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    const idx = this.index(key.hash());
    const bucket = this.buckets[idx];

    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i][0].equals(key)) {
        bucket.splice(i, 1);
        this._size--;
        return true;
      }
    }

    return false;
  }

  get size(): number {
    return this._size;
  }

  private resize(): void {
    const oldBuckets = this.buckets;
    this.capacity *= 2;
    this.buckets = Array.from({ length: this.capacity }, () => []);
    this._size = 0;

    for (const bucket of oldBuckets) {
      for (const [k, v] of bucket) {
        this.set(k, v); // rehash
      }
    }
  }
}

export function hashString(str: string): number {
  let hash = 0x811c9dc5; // FNV offset basis

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }

  return hash >>> 0;
}
