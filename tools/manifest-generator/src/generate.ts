// tools/manifest-generator/src/generate.ts
import { FeatureManifestParser } from './parser';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const projectRoot = process.argv[2] ?? process.cwd();
const outPath     = process.argv[3] ?? path.join(projectRoot, 'public/manifest.json');

const parser  = new FeatureManifestParser(path.join(projectRoot, 'tsconfig.json'));
const results = await parser.parseDirectory(path.join(projectRoot, 'src'));

const allFeatures: any[] = results.map(r => ({
  ...r.meta,
  _source: { file: r.file, line: r.line }
}));

const featureMap = new Map(allFeatures.map((f: any) => [f.id, f]));
const topLevel: any[] = [];

for (const feature of allFeatures) {
  if (feature.parent) {
    const parent = featureMap.get(feature.parent);
    if (parent) {
      (parent.children ??= []).push(feature);
    } else {
      topLevel.push(feature);
    }
  } else {
    topLevel.push(feature);
  }
}

const manifest = {
  generated: new Date().toISOString(),
  project:   path.basename(projectRoot),
  features:  topLevel,
};

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log(`[manifest] ${results.length} features → ${outPath}`);
