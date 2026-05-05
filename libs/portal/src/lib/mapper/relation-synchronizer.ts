import { ApplyContext } from "./mapper";

type PKGetter<T, PK> = (obj: T) => PK;

export abstract class RelationSynchronizer<S, T, PK> {
  constructor(
    private readonly sourcePK: PKGetter<S, PK>,
    private readonly targetPK: PKGetter<T, PK>,
  ) {}

  protected missingPK(_pk: PK): boolean {
    return false;
  }

  protected abstract provide(source: S, ctx: ApplyContext): T;

  protected update(target: T, source: S, ctx: ApplyContext): void {}

  protected delete(_target: T): void {}

  synchronize(source: S[], target: T[], ctx: ApplyContext): T[] {
    const targetMap = new Map<PK, T>();

    for (const t of target) {
      targetMap.set(this.targetPK(t), t);
    }

    const result: T[] = [];

    for (const s of source) {
      const key = this.sourcePK(s);

      if (this.missingPK(key)) {
        const created = this.provide(s, ctx);
        result.push(created);
        continue;
      }

      const existing = targetMap.get(key);

      if (!existing) {
        const created = this.provide(s, ctx);
        result.push(created);
      } else {
        this.update(existing, s, ctx);
        result.push(existing);
        targetMap.delete(key);
      }
    }

    for (const leftover of targetMap.values()) {
      this.delete(leftover);
    }

    return result;
  }
}

export const syncRelation =<S, T, PK>(synchronizer: RelationSynchronizer<S, T, PK>) => {
  return (ctx: ApplyContext) => {
    const result = synchronizer.synchronize((ctx.sourceValue ?? []) as S[], (ctx.targetValue ?? []) as T[], ctx);

    ctx.set(result);
  };
}
