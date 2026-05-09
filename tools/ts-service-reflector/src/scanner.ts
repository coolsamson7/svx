import { Project, Decorator } from "ts-morph";
import { OutputSchema, ClassInfo, MethodInfo, ParameterInfo } from "./types";
import { TypeResolver } from "./type-resolver";

function mapDecorator(d: Decorator) {
  return {
    name: d.getName(),
    arguments: d.getArguments().map((a) => a.getText()),
  };
}

export function scan(tsconfigPath: string): OutputSchema {
  const project = new Project({ tsConfigFilePath: tsconfigPath });
  const resolver = new TypeResolver();

  const classes: ClassInfo[] = [];

  for (const file of project.getSourceFiles()) {
    for (const cls of file.getClasses()) {
      const serviceDecorator = cls.getDecorator("Service");
      if (!serviceDecorator) continue;

      const classInfo: ClassInfo = {
        name: cls.getName()!,
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
          parameters: [], // ✅ now correctly typed
        };

        for (const param of method.getParameters()) {
          const type = param.getType();
          resolver.resolve(type);

          const paramInfo: ParameterInfo = {
            name: param.getName(),
            type: type.getText(),
            decorators: param.getDecorators().map(mapDecorator),
          };

          methodInfo.parameters.push(paramInfo); // ✅ no more "never"
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