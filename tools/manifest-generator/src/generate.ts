// tools/manifest-generator/src/generate.ts
import { FeatureManifestParser } from './parser.ts';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const projectRoot = process.argv[2] ?? process.cwd();
const outPath     = process.argv[3] ?? path.join(projectRoot, 'public/manifest.json');

const parser  = new FeatureManifestParser(path.join(projectRoot, 'tsconfig.json'));
const results = await parser.parseDirectory(path.join(projectRoot, 'src'));

const manifest = {
  generated: new Date().toISOString(),
  project:   path.basename(projectRoot),
  features:  results.map(r => ({
    ...r.meta,          // exactly what's in the code — no divergence possible
    _source: { file: r.file, line: r.line }
  }))
};

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log(`[manifest] ${results.length} features → ${outPath}`);
