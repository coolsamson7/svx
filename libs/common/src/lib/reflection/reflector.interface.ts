export interface ReflectorOutput {
  classes: ReflectedClass[];
  types: ReflectedType[];
}

export interface ReflectedDecorator {
  name: string;
  arguments: string[];
}

export interface ReflectedParameter {
  name: string;
  type: string;
  decorators: ReflectedDecorator[];
}

export interface ReflectedMethod {
  name: string;
  returnType: string;
  decorators: ReflectedDecorator[];
  parameters: ReflectedParameter[];
}

export interface ReflectedClass {
  name: string;
  filePath: string;
  decorators: ReflectedDecorator[];
  methods: ReflectedMethod[];
}

export type ReflectedType =
  | ReflectedInterfaceType
  | ReflectedClassType
  | ReflectedEnumType
  | ReflectedAliasType;

export interface BaseReflectedType {
  kind: "interface" | "class" | "enum" | "type";
  name: string;
  filePath: string;
}

export interface ReflectedProperty {
  name: string;
  type: string;
}

export interface ReflectedInterfaceType extends BaseReflectedType {
  kind: "interface";
  properties: ReflectedProperty[];
}

export interface ReflectedClassType extends BaseReflectedType {
  kind: "class";
  properties: ReflectedProperty[];
}

export interface ReflectedEnumType extends BaseReflectedType {
  kind: "enum";
}

export interface ReflectedAliasType extends BaseReflectedType {
  kind: "type";
  type: string;
}
