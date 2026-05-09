export interface DecoratorInfo {
  name: string;
  arguments: string[];
}

export interface ParameterInfo {
  name: string;
  type: string;
  decorators: DecoratorInfo[];
}

export interface MethodInfo {
  name: string;
  returnType: string;
  decorators: DecoratorInfo[];
  parameters: ParameterInfo[];
}

export interface ClassInfo {
  name: string;
  filePath: string;
  decorators: DecoratorInfo[];
  methods: MethodInfo[];
}

export interface TypeInfo {
  kind: "interface" | "class" | "type" | "enum";
  name: string;
  filePath: string;
  properties?: { name: string; type: string }[];
  type?: string;
}

export interface OutputSchema {
  classes: ClassInfo[];
  types: TypeInfo[];
}
