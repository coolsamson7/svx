#!/usr/bin/env node

import * as fs from 'fs';

import { scan } from './scanner';

const args = process.argv.slice(2);

const tsconfig = args.includes('--tsconfig')
  ? args[args.indexOf('--tsconfig') + 1]
  : 'tsconfig.json';

const outFile = args.includes('--out')
  ? args[args.indexOf('--out') + 1]
  : 'rest-proxies.json';

const watch = args.includes('--watch');

/* =========================================================
 * Run
 * ========================================================= */

function run() {
  const result = scan(tsconfig);

  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));

  console.log(`[proxy-reflector] generated: ${outFile}`);
}

run();

/* =========================================================
 * Watch mode
 * ========================================================= */

if (watch) {
  console.log('[proxy-reflector] watching...');

  fs.watch(process.cwd(), { recursive: true }, (_, filename) => {
    if (!filename?.endsWith('.ts')) return;

    console.log(`[proxy-reflector] change detected: ${filename}`);

    run();
  });
}
