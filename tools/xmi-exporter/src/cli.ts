#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { parseEntities } from './parser/entity-parser';
import { emitXmi } from './emitter/xmi-emitter';

/* ------------------------------------------------------------------ */
/* Argument parsing                                                      */
/* ------------------------------------------------------------------ */

function parseArgs(argv: string[]): { input: string; output: string } {
  const args = argv.slice(2);
  let input: string | null = null;
  let output = 'model.xmi';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && i + 1 < args.length) {
      input = args[++i] ?? null;
    } else if (args[i] === '--output' && i + 1 < args.length) {
      output = args[++i] ?? 'model.xmi';
    }
  }

  if (!input) {
    console.error('Usage: xmi-exporter --input <dir> [--output <file>]');
    process.exit(1);
  }

  return { input: input as string, output };
}

/* ------------------------------------------------------------------ */
/* Main                                                                  */
/* ------------------------------------------------------------------ */

function main(): void {
  const { input, output } = parseArgs(process.argv);

  console.log(`[xmi-exporter] Scanning: ${path.resolve(input)}`);

  let model;
  try {
    model = parseEntities(input);
  } catch (e) {
    console.error(`[xmi-exporter] Fatal error during parsing: ${e}`);
    process.exit(1);
    return; // unreachable but satisfies TS
  }

  console.log(`[xmi-exporter] Found ${model.classes.length} class(es), ${model.dataTypes.length} datatype(s), ${model.associations.length} association(s)`);

  const xmi = emitXmi(model);

  const outputPath = path.resolve(output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, xmi, 'utf-8');

  console.log(`[xmi-exporter] Written: ${outputPath}`);
}

main();
