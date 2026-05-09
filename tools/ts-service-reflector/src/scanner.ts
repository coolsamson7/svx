import { Project, Decorator, Node } from "ts-morph";

import {
  OutputSchema,
  ClassInfo,
  MethodInfo,
  ParameterInfo,
} from "./types";

import { TypeResolver } from "./type-resolver";

/* =========================================================
 * Decorator argument mapper
 * Converts TS AST values into JSON-friendly runtime values
 * ========================================================= */

function mapArgument(arg: Node): any {
  switch (arg.getKindName()) {

    case "StringLiteral":
      return (arg as any).getLiteralValue();

    case "NumericLiteral":
      return Number(arg.getText());

    case "TrueKeyword":
      return true;

    case "FalseKeyword":
      return false;

    case "NullKeyword":
      return null;

    case "ObjectLiteralExpression": {
      const obj: Record<string, any> = {};

      for (const prop of (arg as any).getProperties()) {

        if (Node.isPropertyAssignment(prop)) {
          const name = prop.getName();
          const initializer = prop.getInitializer();

          obj[name] = initializer
            ? mapArgument(initializer)
            : undefined;
        }
      }

      return obj;
    }

    case "ArrayLiteralExpression":
      return (arg as any)
        .getElements()
        .map((e: Node) => mapArgument(e));

    default:
      // fallback to raw TS source text
      return arg.getText();
  }
}

/* =========================================================
 * Decorator mapper
 * ========================================================= */

function mapDecorator(d: Decorator) {
  return {
    name: d.getName(),
    arguments: d.getArguments().map(mapArgument),
  };
}

/* =========================================================
 * Scanner
 * ========================================================= */

export function scan(tsconfigPath: string): OutputSchema {

  const project = new Project({
    tsConfigFilePath: tsconfigPath,
  });

  const resolver = new TypeResolver();

  const classes: ClassInfo[] = [];

  console.log("[reflector] compiler options:");
  console.log(project.getCompilerOptions());

  for (const file of project.getSourceFiles()) {

    for (const cls of file.getClasses()) {

      // include:
      // - abstract service contracts
      // - controller implementations
      const include =
        cls.getDecorator("DeclareService") ||
        cls.getDecorator("Controller");

      if (!include)
        continue;

      console.log(`[reflector] scanning: ${file.getFilePath()}`);

      const classInfo: ClassInfo = {
        name: cls.getName() ?? "AnonymousClass",
        filePath: file.getFilePath(),
        decorators: cls.getDecorators().map(mapDecorator),
        methods: [],
      };

      for (const method of cls.getMethods()) {

        const returnType = method.getReturnType();

        resolver.resolve(returnType);

        const methodInfo: MethodInfo = {
          name: method.getName(),
          returnType: returnType.getText(),
          decorators: method.getDecorators().map(mapDecorator),
          parameters: [],
        };

        for (const param of method.getParameters()) {

          const type = param.getType();

          resolver.resolve(type);

          const paramInfo: ParameterInfo = {
            name: param.getName(),
            type: type.getText(),
            decorators: param.getDecorators().map(mapDecorator),
          };

          methodInfo.parameters.push(paramInfo);
        }

        classInfo.methods.push(methodInfo);
      }

      classes.push(classInfo);
    }
  }

  return {
    classes,
    types: resolver.getAll(),
  };
}
