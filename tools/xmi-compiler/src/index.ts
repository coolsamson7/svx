/**
 * XMI Compiler CLI entry point.
 *
 * Usage:
 *   npx tsx src/index.ts [config.yaml]
 */

import { CompilerPipeline } from './pipeline.js'
import { resolve } from 'node:path'

const configPath = process.argv[2] ?? 'examples/compiler-packages.yaml'

const pipeline = new CompilerPipeline()
const config = CompilerPipeline.loadConfig(resolve(configPath))

pipeline.run(config).catch((err: unknown) => {
  console.error('Compilation failed:', err)
  process.exit(1)
})
