#!/usr/bin/env node

import { scan } from "./scanner";
import * as fs from "fs";
import * as path from "path";

const args = process.argv.slice(2);

const tsconfig = args.includes("--tsconfig")
  ? args[args.indexOf("--tsconfig") + 1]
  : "tsconfig.json";

const outFile = args.includes("--out")
  ? args[args.indexOf("--out") + 1]
  : "services.json";

const watch = args.includes("--watch");

function run() {
  const result = scan(tsconfig);
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`[reflector] Generated: ${outFile}`);
}

run();

if (watch) {
  console.log("[reflector] Watching for changes...");

  fs.watch(process.cwd(), { recursive: true }, (event, filename) => {
    if (!filename!.endsWith(".ts")) return;
    console.log(`[reflector] Change detected: ${filename}`);
    run();
  });
}
