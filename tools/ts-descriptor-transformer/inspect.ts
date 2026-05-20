#!/usr/bin/env tsx
import * as ts from 'typescript'
import * as fs from 'fs'
import { before } from './src/index'

const filePath = process.argv[2]
if (!filePath) { console.error('Usage: tsx inspect.ts <file.ts>'); process.exit(1) }

const source = fs.readFileSync(filePath, 'utf8')
const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2019, true)

const program = ts.createProgram([filePath], { target: ts.ScriptTarget.ES2019 })
const transformer = before({ decorators: ['Reflectable', 'DeclareService', 'DeclareComponent'] }, program)

const result = ts.transform(sourceFile, [transformer])
const printer = ts.createPrinter()
console.log(printer.printFile(result.transformed[0]))
