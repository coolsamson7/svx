/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ArrayType, ObjectType, Type } from "../validation";
import { TypeDescriptor } from "../reflection";
import { GType } from "../lang";
import { Hashable, HashMap, HashSet, hashString } from "../collections";

/* =========================================================
 * PRIMITIVES
 * ========================================================= */

const PRIMITIVE_CTORS = new Set<Function>([
  String, Number, Boolean, Date, Symbol, BigInt,
]);

function isPrimitiveCtor(ctor: unknown): boolean {
  return typeof ctor === "function" && PRIMITIVE_CTORS.has(ctor as Function);
}

// helpers

function isArray(v: any): v is any[] {
  return Array.isArray(v);
}

function isSet(v: any): v is Set<any> {
  return v instanceof Set;
}

function toIterable(v: any): any[] {
  if (isArray(v)) return v;
  if (isSet(v)) return Array.from(v);
  return [];
}

//

export class ConversionKey implements Hashable {
  constructor(
    public readonly from: string,
    public readonly to: string
  ) {}

  toString() {
    return `${this.from}->${this.to}`;
  }

  // implement Hashable

  hash(): number {
    let h = 17;
    h = h * 31 + hashString(this.from);
    h = h * 31 + hashString(this.to);
    return h;
  }

  equals(other: ConversionKey) {
    return this.from === other.from && this.to === other.to;
  }
}

export class ConverterRegistry {
  // static

  static global = new ConverterRegistry()
    .register("number", "string", v => String(v))
    .register("string", "number", v => Number(v))
    .register("boolean", "string", v => String(v))
    .register("string", "boolean", v => v === "true")
    .register("date", "string", v => (v instanceof Date ? v.toISOString() : String(v)))
    .register("string", "date", v => new Date(v))
    .register("number", "boolean", v => Boolean(v))
    .register("boolean", "number", v => Number(v))
                    ;
  // instance data

  private map = new HashMap<ConversionKey, ConverterFn>();

  // constructor

  constructor(base?: ConverterRegistry) {
    if (base) {
      this.map = base.map.clone()
    }
  }

  register(source: string, target: string, fn: ConverterFn) : ConverterRegistry {
    this.map.set(new ConversionKey(source, target), fn);
    return this;
  }

  get(from: string, to: string): ConverterFn | undefined {
    return this.map.get(new ConversionKey(from, to));
  }
}

/* =========================================================
 * AUTO-CONVERT REGISTRY
 * ========================================================= */

type ConverterFn = (value: any) => any;

class TypePairKey implements Hashable {
  constructor(
    public readonly source: TypeModel<any>,
    public readonly target: TypeModel<any>
  ) {}

  // implement Hashable

  hash(): number {
    let h = 17;
    h = h * 31 + this.source.hash();
    h = h * 31 + this.target.hash();
    return h;
  }

  equals(other: TypePairKey): boolean {
    return this.source.equals(other.source) && this.target.equals(other.target);
  }
}

/* =========================================================
 * MAPPING CONTEXT  (cycle / dedup tracking per map() call)
 * ========================================================= */

export class MappingContext {
  private cache = new WeakMap<object, any>();

  constructor(public readonly mapper?: Mapper) {}

  has(source: object): boolean     { return this.cache.has(source); }
  get(source: object): any         { return this.cache.get(source); }
  set(source: object, result: any) { this.cache.set(source, result); }
}

/* =========================================================
 * TYPE SOURCE  (unified over ObjectType and class)
 * ========================================================= */

export abstract class TypeModel<T = any> implements Hashable {
  // static

  static of<T>(input: ObjectType<T> | GType<T>): TypeModel<T> {
    if (input instanceof ObjectType)
      return ObjectTypeModel.forType(input);
    else
      return ClassTypeModel.of(input as GType<T>);
  }


  // properties

  readonly elementType? : TypeModel<any>
  protected properties : Record<string,TypeModel<any>> = {}

  // constructor

  constructor(public name: string) {}

  // abstract

  getPaths(): string[] {
    const result: string[] = [];

    const compute = (typeModel: TypeModel, prefix = "") => {
      for (const fieldName in typeModel.properties) {
        const field = typeModel.properties[fieldName];

        const path = prefix ? `${prefix}.${fieldName}` : fieldName;
        result.push(path);

        if (field.isArray()) {
          compute(field.getElementType()!, path);
        }
        else if (field.isObject()) {
          compute(field, path);
        }
      }
    };

    compute(this)

    return result;
  }

  getType(path: string): TypeModel<any> | undefined {
    let last : TypeModel<any> | undefined = this
    let type : TypeModel<any> | undefined = this
    for ( const property of path.split(".")) {
      type  = last?.properties[property]

      if (!type)
        throw Error("unknown property " + last?.name + "." + property )

      if ( type.isArray())
        last = type.elementType!;
      else
        last = type
    }

    return type
  }

  getElementType() : TypeModel<any> | undefined {
     return undefined
  }

  isArray() : boolean {
    return false
  }

  isLiteral() : boolean {
    return false
  }

  isObject() : boolean {
    return false
  }

  createInstance(): T {
    throw Error("createInstance is not supported")
  }

  // implement Hashable

  hash(): number {
    return hashString(this.name)
  }

  abstract equals(other: any): boolean
}

class ArrayTypeModel<T> extends TypeModel<T> {
    // constructor

    constructor(public readonly elementType: TypeModel<T>) {
      super("array");
    }

    isArray() : boolean {
      return true
    }

    getElementType(): TypeModel<any> {
      return this.elementType;
    }

    equals(other: any): boolean {
      return this === other
    }
}

class PrimitiveTypeModel<T> extends TypeModel<T> {
   // static

   static types : Record<string,PrimitiveTypeModel<any>> = {}

   static forName(type: string) {
     type = type.toLowerCase()
     let typeModel = PrimitiveTypeModel.types[type]
     if (!typeModel)
         PrimitiveTypeModel.types[type] = typeModel = new PrimitiveTypeModel(type)

    return typeModel
   }

   // constructor

   constructor(name: string) {
     super(name);
   }

   // implement

   isLiteral() : boolean {
    return true
  }

  equals(other: any): boolean {
    return this === other
  }
}

/* ORM

class TypeOrmTypeModel<T> extends TypeModel<T> {
  constructor(private readonly meta: any) {
    super();
  }

  get name(): string {
    return this.meta.name;
  }

  createInstance(): T {
    return new this.meta.target() as T;
  }

  getPaths(prefix = ""): string[] {
    const result: string[] = [];

    for (const col of this.meta.columns) {
      const path = prefix ? `${prefix}.${col.propertyName}` : col.propertyName;
      result.push(path);
    }

    for (const rel of this.meta.relations) {
      const path = prefix ? `${prefix}.${rel.propertyName}` : rel.propertyName;
      result.push(path);

      // recurse for nested
      try {
        const nested = new TypeOrmTypeModel(rel.inverseEntityMetadata);
        result.push(...nested.getPaths(path));
      } catch {
        /* ignore *
      }
    }

    return result;
  }

  getType(path: string): TypeModel<any> | undefined {
    const [first] = path.split(".");

    const rel = this.meta.relations.find((r: any) => r.propertyName === first);
    if (!rel) return undefined;

    return new TypeOrmTypeModel(rel.inverseEntityMetadata);
  }


  // implement Hashable

  equals(other: any): boolean {
    return other instanceof TypeOrmTypeModel && other.meta === this.meta;
  }
}*/

/* --- ObjectType wrapper --- */

class ObjectTypeModel extends TypeModel<any> {
  // static

  static classes : Map<Type<any>,ObjectTypeModel> = new Map();

  static forType<T>(type: Type<any>) : TypeModel<T> {
    let result = ObjectTypeModel.classes.get(type)
    if (!result) {
      if ( type instanceof ArrayType)
        return new ArrayTypeModel(ObjectTypeModel.forType(type.element))

      else if ( type instanceof ObjectType)
        ObjectTypeModel.classes.set(type, result = new ObjectTypeModel(type))

      else
        return PrimitiveTypeModel.forName(type.baseType)
    }

    return result
  }

  // constructor

  constructor(private type: Type<any>) {
    super(type.name!);

    this.analyze(type)
  }

  // private

  private analyze(descriptor: Type<any>) {
     if ( descriptor instanceof ObjectType)
      for ( const propertyName in descriptor.shape) {
        const type = descriptor.shape[propertyName]

        this.properties[propertyName] = ObjectTypeModel.forType(type)
      }
  }

  // implement

  isObject() : boolean {
    return true
  }

  createInstance(): any {
    return {};
  }

  // implement Hashable

  equals(other: any): boolean {
    return other instanceof ObjectTypeModel && other.type === this.type; // TODO?
  }
}

/* --- Class wrapper (uses TypeDescriptor / reflect-metadata) --- */

class ClassTypeModel<T=any> extends TypeModel<T> {
  // static

  static classes : Map<GType<any>,ClassTypeModel> = new Map();

  static of<T>(type: GType<T>) {
    let result = ClassTypeModel.classes.get(type)
    if (!result) {

      ClassTypeModel.classes.set(type, result = new ClassTypeModel<T>(type))
    }

    return result
  }

  // instance data

  private readonly descriptor: TypeDescriptor<T>;

  private analyze(descriptor: TypeDescriptor<T>) {
    for ( const property of descriptor.getFields()) {
      const type = property.propertyType

      let typeModel
      if (type === Array) {
        typeModel = new ArrayTypeModel(ClassTypeModel.of(property.elementType))
      }
      else if (isPrimitiveCtor(type)) {
        typeModel = PrimitiveTypeModel.forName(type.name)
      }
      else {
        // class
        typeModel = ClassTypeModel.of(type)
      }

      this.properties[property.name] = typeModel
    }
  }

  // constructor

  constructor(ctor: GType<T>) {
    super(ctor.name); // ?

    this.analyze(this.descriptor = TypeDescriptor.forType(ctor));
  }

  // implement

  isObject() : boolean {
    return true
  }

  createInstance(): any { return this.descriptor.create(); }

  // implement Hashable

  equals(other: any): boolean {
    return other instanceof ClassTypeModel && other.descriptor === this.descriptor;
  }
}

/* =========================================================
 * GETTER / SETTER  (split once at compile time)
 * ========================================================= */

type Getter<CTX=MappingContext> = (src: any, ctx: CTX) => any;
type Setter<CTX=MappingContext> = (tgt: any, value: any, ctx: CTX) => void;

function compileGetter(path: string): Getter<any> {
  // fast path: no nesting
  if (!path.includes(".")) {
    return (obj: any) => obj?.[path];
  }

  const segs = path.split(".");
  return (obj: any) => {
    let v = obj;
    for (let i = 0; i < segs.length; i++) {
      if (v == null) return undefined;
      v = v[segs[i]];
    }
    return v;
  };
}

function compileSetter(path: string): Setter<any> {
  // fast path: no nesting
  if (!path.includes(".")) {
    return (obj: any, value: any) => {
      obj[path] = value;
    };
  }

  const segs = path.split(".");
  const last = segs.length - 1;

  return (obj: any, value: any) => {
    let v = obj;
    for (let i = 0; i < last; i++) {
      const key = segs[i];
      if (v[key] == null) v[key] = {};
      v = v[key];
    }
    v[segs[last]] = value;
  };
}

/* =========================================================
 * OPERATIONS
 * ========================================================= */

abstract class Operation<CTX=MappingContext> {
  abstract execute(src: any, tgt: any, ctx: CTX): void;
  abstract describe(indent?: string): string;
}

export type ApplyContext<T = any> = {
  sourceValue: any;
  targetValue: any;

  sourceObject: any;
  targetObject: any;

  mapper: Mapper;

  set: (v: T) => void;
};

class CollectionOp extends Operation<MappingContext> {
  constructor(
    private readonly getter: Getter<MappingContext>,
    private readonly setter: Setter<MappingContext>,
    private readonly subTransformer: Transformer<MappingContext> | null,
    private readonly fromPath: string,
    private readonly toPath: string,
    private readonly targetKind: "array" | "set",
  ) { super(); }

  execute(src: any, tgt: any, ctx: MappingContext): void {
    const value = this.getter(src, ctx);

    if (value == null) {
      this.setter(tgt, value, ctx);
      return;
    }

    const items = toIterable(value);

    let result: any;

    if (this.subTransformer) {
      const mapped = items.map(v =>
        this.subTransformer!.transform(v, ctx)
      );
      result = this.targetKind === "set" ? new Set(mapped) : mapped;
    } else {
      // primitive copy
      result = this.targetKind === "set"
        ? new Set(items)
        : items.slice();
    }

    this.setter(tgt, result, ctx);
  }

  describe(indent = ""): string {
    return `${indent}${this.toPath} = deep(${this.fromPath})`;
  }
}

class ValueOp extends Operation<MappingContext> {
  constructor(
    private readonly setter: Setter<MappingContext>,
    private readonly value: any | ((ctx: MappingContext) => any),
    private readonly toPath: string,
  ) { super(); }

  execute(_src: any, tgt: any, ctx: MappingContext): void {
    const v = typeof this.value === "function"
      ? (this.value as any)(ctx)
      : this.value;

    this.setter(tgt, v, ctx);
  }

  describe(indent = ""): string {
    return `${indent}${this.toPath} = ${JSON.stringify(this.value)}`;
  }
}

class ApplyOp extends Operation<MappingContext> {
  constructor(
    private readonly getter: Getter<MappingContext>,
    private readonly setter: Setter<MappingContext>,
    private readonly fn: (ctx: any) => void,
    private readonly fromPath: string,
    private readonly toPath: string,
  ) {
    super();
  }

  execute(src: any, tgt: any, ctx: MappingContext): void {
    const sourceValue = this.getter(src, ctx); // TODO getter is WF split path huh?

  // direct read from already-built target object
  const targetValue = this.getter(tgt, ctx);

  const applyCtx = {
    sourceValue,
    targetValue,
    sourceObject: src,
    targetObject: tgt,
    mapper: ctx.mapper,
    set: (v: any) => this.setter(tgt, v, ctx),
  };

  this.fn(applyCtx);
  }

  describe(indent = ""): string {
    return `${indent}${this.toPath} = apply(${this.fromPath})`;
  }
}

class TransferOp<CTX> extends Operation<CTX> {
  constructor(
    private readonly getter:   Getter<CTX>,
    private readonly setter:   Setter<CTX>,
    private readonly fromPath: string,
    private readonly toPath:   string,
  ) { super(); }

  execute(src: any, tgt: any, ctx: CTX): void {
    this.setter(tgt, this.getter(src, ctx), ctx);
  }

  describe(indent = ""): string {
    return `${indent}${this.toPath} = ${this.fromPath}`;
  }
}

class TransferConvertOp<CTX> extends Operation<CTX> {
  constructor(
    private readonly getter:   Getter<CTX>,
    private readonly setter:   Setter<CTX>,
    private readonly convert:  ConvertHandlers,
    private readonly fromPath: string,
    private readonly toPath:   string,
    private readonly label = "convert",
  ) { super(); }

  execute(src: any, tgt: any, ctx: CTX): void {
    const sourceValue = this.getter(src, ctx);

    const result = this.convert.target
      ? this.convert.target(sourceValue)
      : sourceValue;

    this.setter(tgt, result, ctx);
  }

  describe(indent = ""): string {
    return `${indent}${this.toPath} = ${this.fromPath} ${this.label} `;
  }
}

class DeepOp extends Operation<MappingContext> {
  constructor(
    private readonly getter:         Getter<MappingContext>,
    private readonly setter:         Setter<MappingContext>,
    private readonly subTransformer: Transformer<MappingContext>,
    private readonly fromPath:       string,
    private readonly toPath:         string,
  ) { super(); }

  execute(src: any, tgt: any, ctx: MappingContext): void {
    const nested = this.subTransformer.transform(this.getter(src, ctx), ctx, undefined);

    this.setter(tgt, nested, ctx);
  }

  describe(indent = ""): string {
    return [
      `${indent}${this.toPath} = deep(${this.fromPath})`,
      //this.subTransformer.describe(indent + "  "),
    ].join("\n");
  }
}

/* =========================================================
 * TRANSFORMER  (compiled mapping unit)
 * ========================================================= */

export class Transformer<CTX extends MappingContext=MappingContext> {
  constructor(
    private readonly ops:          Operation<CTX>[],
    private readonly targetSource: TypeModel<any>,
  ) {}

  /**
   * transform(source, ctx, mctx)
   *   — always allocates a fresh target instance via targetSource.createInstance()
   *
   * transform(source, ctx, mctx, target)
   *   — writes into the supplied existing target (patch / merge use-case)
   */
  transform(source: any, ctx: CTX, target?: any): any {
    if (source) {
      if (ctx.has(source))
        return ctx.get(source);
    }

    const result: any = target ?? this.targetSource.createInstance();

    if (source)
      ctx.set(source, result);

    for (let i = 0; i < this.ops.length; i++)
      this.ops[i].execute(source, result, ctx);

    return result;
  }

  describe(indent = ""): string {
    return this.ops.map(op => op.describe(indent)).join("\n");
  }

  toString() { return this.describe(); }
}

/* =========================================================
 * TYPE-LEVEL PATHS
 * ========================================================= */

export type Primitive =
  | string | number | boolean | bigint | symbol | null | undefined | Date;

export type Path<T> =
  T extends Primitive
    ? never
    : { [K in keyof T & string]:
          T[K] extends Primitive ? K : K | `${K}.${Path<T[K]>}`
      }[keyof T & string];

export type ConvertHandlers = {
  target?: (value: any) => any;
  source?: (value: any) => any;
};

export type ApplyHandlers = {
  source?: (ctx: ApplyContext) => void;
  target?: (ctx: ApplyContext) => void;
}

/* =========================================================
 * RULE
 * ========================================================= */

export class Rule<S = any, T = any> {
 options: {
   convert?: ConvertHandlers;
   deep?:        boolean;
   autoConvert?: boolean;

   apply?: ApplyHandlers,
   value?: any;
 } = {}

  constructor(public from: string, public to: string) {}
}

/* =========================================================
 * MAPPING DEFINITION
 * ========================================================= */

export class MappingDefinition<S = any, T = any> {
  // instance data

  transformer?: Transformer<MappingContext>
  reverse! : MappingDefinition<any,any>

  // constructor

  constructor(
    public readonly source: TypeModel<S>,
    public readonly target: TypeModel<T>,
    public readonly rules:  Rule<S, T>[]
  ) {}

  // public

  compile(mapper: Mapper) {
    this.transformer = mapper.getOrCompile(this)
  }
}

/* =========================================================
 * RULE BUILDER  (DSL)
 * ================== ======================================= */

export class MappingBuilder<S, T> {
  private rules:           Rule<S, T>[] = [];
  private pendingMatching: Array<() => void>  = [];

  constructor(
    private readonly source: TypeModel<S>,
    private readonly target: TypeModel<T>,
  ) {}

  value<V>(val: V | ((ctx: MappingContext) => V)) {
    const self = this;

    return {
      to<K2 extends Path<T>>(targetPath: K2) {
        const rule = new Rule<S, T>("null", targetPath as string);
        rule.options.value = val;
        self.rules.push(rule);

        return {
          // optional chaining with convert/apply/etc if you want
        };
      }
    };
  }

  from<K extends Path<S>>(path: K) {
    const self = this;
    return {
      to<K2 extends Path<T>>(targetPath: K2) {
        const rule = new Rule<S, T>(path as string, targetPath as string);
        self.rules.push(rule);
        return {
          convert(convert: ConvertHandlers) {
            rule.options.convert = convert;
            return this;
          },
          autoConvert() {
            rule.options.autoConvert = true;
            return this;
          },
          deep() {
            rule.options.deep = true;
            return this;
          },
          apply(cfg: ApplyHandlers) {
            rule.options.apply = cfg;

            return this;
          }
        };
      },
    };
  }

  matching() {
    const self = this;
    let applied = false;

    const apply = (excluded: string[]) => {
      const sourcePaths = self.source.getPaths();
      const targetPaths = new Set(self.target.getPaths());

      for (const p of sourcePaths) {
        if (excluded.includes(p))
          continue;

        if (!targetPaths.has(p))
          continue;

        if (self.rules.some(r => r.from === p))
         continue; // skip already-covered paths

        if (p.indexOf(".") == -1) // hack todo
          self.rules.push(new Rule(p, p));
      }
    };

    const api = {
      except(...excluded: Path<S>[]) {
        if (!applied) { applied = true; apply(excluded as string[]); }
        return api;
      },
    };

    this.pendingMatching.push(() => { if (!applied) apply([]); });
    return api;
  }

  build(): MappingDefinition<S, T> {
    for (const fn of this.pendingMatching)
       fn();

    return new MappingDefinition(this.source, this.target, this.rules);
  }
}

/* =========================================================
 * FACTORY
 * ========================================================= */

export function mapping<S, T>(
  source: ObjectType<S> | GType<S>,
  target: ObjectType<T> | GType<T>,
  fn: (r: MappingBuilder<S, T>) => void
): MappingDefinition<S, T> {
  const builder = new MappingBuilder<S, T>(TypeModel.of(source), TypeModel.of(target));

  fn(builder);

  return builder.build();
}

/* =========================================================
 * MAPPER
 * ========================================================= */

export type direction = "forward" | "reverse"

export interface MapOptions<S = any, T = any> {
  /** optional: choose mapping explicitly */
  sourceType?: ObjectType<S> | GType<S>;

  direction?: direction

  /** optional: map into existing instance */
  target?: T;

  /** optional: mapping context */
  ctx?: MappingContext;
}

export interface MapperOptions {
  validate?: boolean;
  autoDeep?: boolean;
  checkFields?: boolean;
}

export class Mapper {
  // instance data

  private options: MapperOptions = {
      validate: false,
      autoDeep: false,
      checkFields: false,
    };
  private readonly transformers = new HashMap<TypePairKey, Transformer<MappingContext>>();
  private readonly compiling    = new HashSet<TypePairKey>();
  private readonly definitions: MappingDefinition<any, any>[];
  private converters = ConverterRegistry.global;

  // constructor

  constructor(...definitions: MappingDefinition<any, any>[]) {
    this.definitions = definitions;

    this.detectCycles();

    // add reverse definitions

    this.definitions.push(...this.definitions.map(def => this.reverseDefinition(def))); // hmmm...always?

    // compile

    for (const def of definitions)
       def.compile(this)
  }

  // admin

  setOptions(options: MapperOptions): Mapper {
    this.options = { ...this.options, ...options };
    return this;
  }

  registerConverter(from: string, to: string, fn: ConverterFn): Mapper {
    // clone own registry

    if ( this.converters === ConverterRegistry.global )
      this.converters = new ConverterRegistry(this.converters);

    this.converters.register(from, to, fn);

    return this;
  }

  // public


  private findDefinition(types: {source?: TypeModel<any>, target?: TypeModel<any>}) :  MappingDefinition<any, any> | undefined {
    const { source, target } = types;
    return this.definitions.find(def =>
      (source == undefined || def.source.equals(source)) &&
      (target == undefined || def.target.equals(target))
    )
  }

  private getDefinition(types: {source?: TypeModel<any>, target?: TypeModel<any>}) : MappingDefinition<any, any> {
    const { source, target } = types;
    const definition = this.findDefinition(types)
    if (definition)
      return definition
    else
      throw new Error(
        `No mapping found for source=${source?.name ?? "?"}, target=${target?.name ?? "?"}`
      );
  }

  mapList<S, T>(source: S[], options?: MapOptions<S, T>) : T[] {
    return source.map(s => this.map(s, options)) // TODO only one context!
  }

  map<S, T>(source: S, options?: MapOptions<S, T>) : T {
    const {
      sourceType,
      //targetType, we always pass sourceType no matter what direction
      direction = "forward",
      target,
      ctx = new MappingContext(this)
    } = options ?? {};

    // find definition

    let definition : MappingDefinition<any,any>

    if ( sourceType ) {
       if ( direction == "forward")
         definition = this.getDefinition({source: TypeModel.of(sourceType)})
       else
         definition = this.getDefinition({target: TypeModel.of(sourceType)})
    }
    else {
       if ( direction == "forward")
          definition = this.definitions[0]
       else
          definition = this.definitions[0].reverse
    }

    return definition.transformer?.transform(source, ctx, target)
  }

  report(): string {
    const lines: string[] = [];
    for (const def of this.definitions) {
      const t = this.findTransformer(def.source, def.target);
      lines.push(`mapping(${def.source.name},${def.target.name})`);
      lines.push(t ? t.describe("  ") : "  (not compiled)");
      lines.push("");
    }
    return lines.join("\n");
  }

  toString() { return this.report(); }

  /* ---- compilation ---- */

  private reverseDefinition(def: MappingDefinition<any, any>): MappingDefinition<any, any> {
    const reversedRules: Rule[] = [];

    for (const rule of def.rules) {
      // skip non-reversible rules

      if (rule.options.value)
        continue;

      const r = new Rule(rule.to, rule.from);

      // deep stays deep

      if (rule.options.deep) {
        r.options.deep = true;
      }

      // convert apply

    if (rule.options.apply)
      if (rule.options.apply.source) {
        r.options.apply = {
          target: rule.options.apply.source
        };
      }

      // convert swap

      if (rule.options.convert)
        if (!rule.options.convert.source) {
          r.options.convert = {
            target: rule.options.convert.source
          };
        }

      // autoConvert stays enabled (registry handles direction)

      if (rule.options.autoConvert) {
        r.options.autoConvert = true;
      }

      reversedRules.push(r);
    }

    const res = new MappingDefinition(
      def.target,
      def.source,
      reversedRules
    );

    res.reverse = def
    def.reverse = res

    return res
  }

  getOrCompile(def: MappingDefinition<any, any>): Transformer<MappingContext> {
    const existing = this.findTransformer(def.source, def.target);
    if (existing)
      return existing;

    if (this.isCompiling(def.source, def.target))
      throw new Error(
        `Circular mapping detected for "${def.source.name}" → "${def.target.name}"`
      );

    const key = new TypePairKey(def.source, def.target);
    this.compiling.add(key);

    const ops: Operation<MappingContext>[] = [];

    for (const rule of def.rules) {
      const setter = compileSetter(rule.to);

      // --------------------------------------------------
      // value()
      // --------------------------------------------------
      if (rule.options.value !== undefined) {
        ops.push(
          new ValueOp(
            setter,
            rule.options.value,
            rule.to
          )
        );
        continue;
      }

      const getter = compileGetter(rule.from);

      // --------------------------------------------------
      // apply()
      // --------------------------------------------------
      if (rule.options.apply) {
        ops.push(
          new ApplyOp(
            getter,
            setter,
            rule.options.apply.target!,
            rule.from,
            rule.to
          )
        );
        continue;
      }

      const isExplicitDeep = rule.options.deep === true;

      // 🔥 IMPORTANT: resolve BOTH sides

      const sourceType = def.source.getType(rule.from);
      const targetType = def.target.getType(rule.to);

      // --------------------------------------------------
      // COLLECTION
      // --------------------------------------------------

      if (sourceType?.isArray()) {
        let subTransformer: Transformer<MappingContext> | null = null;

        if (sourceType && targetType) {
          const subDef = this.findDefinition({source: sourceType.elementType, target: targetType.elementType});

          if (subDef) {
            subTransformer = this.getOrCompile(subDef);
          }
        }

        ops.push(
          new CollectionOp(
            getter,
            setter,
            subTransformer,
            rule.from,
            rule.to,
            "array"// TODO targetType!.name! // ??
          )
        );

        continue;
      }

      // --------------------------------------------------
      // DEEP / AUTO-DEEP
      // --------------------------------------------------

      const hasMappingForNested = sourceType && targetType ? this.findDefinition({source: sourceType, target: targetType}) : false;

      const isAutoDeep =
        this.options.autoDeep &&
        !isExplicitDeep &&
        hasMappingForNested;

      if (isExplicitDeep || isAutoDeep) {
        if (!sourceType || !targetType) {
          throw new Error(
            `"${rule.from}" is not a nested object type in "${def.source.name}"`
          );
        }

        const subDef = this.findDefinition({source: sourceType, target: targetType})

        if (!subDef) {
          throw new Error(
            `No mapping() found for deep path "${rule.from}" in "${def.source.name}" → "${def.target.name}"`
          );
        }

        ops.push(
          new DeepOp(
            getter,
            setter,
            this.getOrCompile(subDef),
            rule.from,
            rule.to
          )
        );

        continue;
      }

      // --------------------------------------------------
      // AUTO CONVERT
      // --------------------------------------------------

      if (rule.options.autoConvert) {
        if (!sourceType?.name || !targetType?.name) {
          throw new Error(
            `autoConvert: cannot determine field types for ` +
            `"${rule.from}" (${sourceType?.name ?? "?"}) → "${rule.to}" (${targetType?.name ?? "?"}) ` +
            `in mapping "${def.source.name}" → "${def.target.name}"`
          );
        }

        const converter = this.converters.get(sourceType?.name, targetType?.name);

        if (!converter) {
          throw new Error(
            `autoConvert: no built-in converter for ${sourceType?.name}->${targetType?.name} ` +
            `(rule "${rule.from}" → "${rule.to}")`
          );
        }

        ops.push(
          new TransferConvertOp(
            getter,
            setter,
            { target: (v) => converter(v) }, // TODO QUATSCH
            rule.from,
            rule.to,
            `autoConvert(${sourceType?.name}->${targetType?.name})`,
          )
        );

        continue;
      }

      // --------------------------------------------------
      // CUSTOM CONVERT
      // --------------------------------------------------
      if (rule.options.convert) {
        ops.push(
          new TransferConvertOp(
            getter,
            setter,
            rule.options.convert,
            rule.from,
            rule.to
          )
        );
        continue;
      }

      // --------------------------------------------------
      // DEFAULT TRANSFER
      // --------------------------------------------------
      ops.push(
        new TransferOp(
          getter,
          setter,
          rule.from,
          rule.to
        )
      );
    }

    const transformer = new Transformer(ops, def.target);

    this.transformers.set(key, transformer);

    // remove from compiling

    this.compiling.delete(key);

    return transformer;
  }
  /* ---- isSameAs-aware helpers ---- */

  private findTransformer(source: TypeModel<any>, target: TypeModel<any>): Transformer<MappingContext> | undefined {
    return this.transformers.get(new TypePairKey(source, target));
  }

  private isCompiling(source: TypeModel<any>, target: TypeModel<any>): boolean {
    return this.compiling.has(new TypePairKey(source, target))
  }

  /* ---- cycle detection (pre-flight) ---- */

  private detectCycles() {
    const visit = (source: TypeModel<any>, stack: TypeModel<any>[]) => {
      if (stack.some(s => s.equals(source))) {
        const names = [...stack.map(s => s.name), source.name];
        throw new Error(`Circular mapping: ${names.join(" → ")}`);
      }

      const def = this.findDefinition({source: source});
      if (!def)
        return;

      for (const rule of def.rules) {
        if (!rule.options.deep)
          continue;

        const nestedSource = def.source.getType(rule.from);
        if (!nestedSource)
          continue;

        const subDef = this.definitions.find(d => d.source.equals(nestedSource));
        if (subDef)
          visit(subDef.source, [...stack, source]);
      }
    };

    for (const def of this.definitions)
      visit(def.source, []);
  }
}
