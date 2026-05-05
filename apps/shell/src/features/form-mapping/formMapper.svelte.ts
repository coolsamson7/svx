// ── Type utilities ────────────────────────────────────────────────────────────

type Primitive = string | number | boolean | bigint | null | undefined;

/** All dot-notation paths to leaf nodes of T */
export type DotPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: NonNullable<T[K]> extends Primitive
    ? Prefix extends "" ? K : `${Prefix}.${K}`
    : NonNullable<T[K]> extends object
    ? DotPaths<NonNullable<T[K]>, Prefix extends "" ? K : `${Prefix}.${K}`>
    : never;
}[keyof T & string];

/** Value type at a given dot-path */
export type PathValue<T, P extends string> =
  P extends keyof T
    ? T[P]
    : P extends `${infer K}.${infer R}`
    ? K extends keyof T
      ? PathValue<NonNullable<T[K]>, R>
      : never
    : never;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAt(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

function setAt(obj: any, path: string, value: any): void {
  const parts = path.split(".");
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts.at(-1)!] = value;
}

function deepAssign(target: any, source: any): void {
  for (const key of Object.keys(source)) {
    const v = source[key];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      deepAssign(target[key], v);
    } else {
      target[key] = v;
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createForm<T extends object>(initial: T) {
  // $state on the whole object — Svelte's proxy makes nested writes reactive
  const values: T = $state(structuredClone(initial));

  // $state so isDirty reacts when save/write update the baseline
  let original = $state(structuredClone(initial));

  const isDirty = $derived(
    JSON.stringify(values) !== JSON.stringify(original)
  );

  /** Typed path getter — full autocomplete + return type */
  function get<P extends DotPaths<T>>(path: P): PathValue<T, P> {
    return getAt(values, path as string);
  }

  /** Typed path setter */
  function set<P extends DotPaths<T>>(path: P, value: PathValue<T, P>): void {
    setAt(values, path as string, value);
  }

  //
  function reset(): void {
  deepAssign(values, structuredClone($state.snapshot(original)));
}

/** Returns a deep clone of current field values */
function getData(): T {
  return structuredClone($state.snapshot(values)) as T;
}

/**
 * Save: fields → model.
 */
function save(): T {
  const snapshot = structuredClone($state.snapshot(values)) as T;
  original = structuredClone(snapshot);
  return snapshot;
}

/**
 * Write: model → fields.
 */
function write(model: T): void {
  deepAssign(values, structuredClone(model));
  original = structuredClone(model);
}
  //

  return {
    /** Direct reactive object — use for bind:value={form.values.name} */
    values,
    /** Typed dot-path getter */
    get,
    /** Typed dot-path setter */
    set,
    /** Getter wrapper keeps $derived reactive across the function boundary */
    get isDirty() { return isDirty; },
    /** Reset to last save/write baseline */
    reset,
    /** Deep clone of current values */
    getData,
    /** fields → baseline, returns clone for API */
    save,
    /** model → fields, resets baseline */
    write,
  };
}

// ── Type export ───────────────────────────────────────────────────────────────

export type Form<T extends object> = ReturnType<typeof createForm<T>>;
