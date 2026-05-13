import { Project } from 'ts-morph';

import { extractController } from './extractor';

import { ProxySchema } from './types';

export function scan(tsconfigPath: string): ProxySchema {
  const project = new Project({
    tsConfigFilePath: tsconfigPath,
  });

  const result: ProxySchema = {};

  for (const file of project.getSourceFiles()) {
    for (const cls of file.getClasses()) {
      const controller = extractController(cls);

      if (!controller) continue;

      console.log(`[proxy-reflector] scanning: ${file.getBaseName()}`);

      // @ts-ignore
      result[controller.name] = controller.schema;
    }
  }

  return result;
}
