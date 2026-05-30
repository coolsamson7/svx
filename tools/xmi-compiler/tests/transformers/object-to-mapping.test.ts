import { describe, it, expect, beforeAll } from 'vitest'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { XmiParser } from '../../src/xmi/parser/xmi-parser.js'
import { XmiToObjectTransformer } from '../../src/transformers/xmi-to-object/transformer.js'
import { ObjectToMappingTransformer } from '../../src/transformers/object-to-mapping/transformer.js'
import { DefaultNamingStrategy } from '../../src/naming/default-strategy.js'
import { DEFAULT_NAMING_CONFIG } from '../../src/config/defaults.js'
import type { PersistenceModel } from '../../src/model/mapping/types.js'
import type { ObjectModel } from '../../src/model/object/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const XMI_PATH = resolve(__dirname, '../../examples/model.xmi')

describe('ObjectToMappingTransformer', () => {
  let model: ObjectModel
  let persistenceModel: PersistenceModel

  beforeAll(() => {
    const parser = new XmiParser()
    const parsed = parser.parseFile(XMI_PATH)
    const xmiTransformer = new XmiToObjectTransformer()
    model = xmiTransformer.transform(parsed)

    const naming = new DefaultNamingStrategy(DEFAULT_NAMING_CONFIG)
    const mappingTransformer = new ObjectToMappingTransformer(naming)
    persistenceModel = mappingTransformer.transform(model)
  })

  it('creates a mapping for Customer', () => {
    expect(persistenceModel.mappings['Customer']).toBeDefined()
  })

  it('Customer maps to CUSTOMER table', () => {
    const mapping = persistenceModel.mappings['Customer']
    expect(mapping.table).toBe('CUSTOMER')
  })

  it('Order maps to ORDER table', () => {
    const mapping = persistenceModel.mappings['Order']
    expect(mapping.table).toBe('ORDER')
  })

  it('firstName maps to FIRST_NAME column', () => {
    const mapping = persistenceModel.mappings['Customer']
    const field = mapping.fields.find(f => f.property === 'firstName')
    expect(field).toBeDefined()
    expect(field!.column).toBe('FIRST_NAME')
  })

  it('id field is marked as primary key', () => {
    const mapping = persistenceModel.mappings['Customer']
    const id = mapping.fields.find(f => f.property === 'id')
    expect(id).toBeDefined()
    expect(id!.primaryKey).toBe(true)
  })

  it('id field has uuid generation', () => {
    const mapping = persistenceModel.mappings['Customer']
    const id = mapping.fields.find(f => f.property === 'id')
    expect(id!.generated).toBe('uuid')
  })

  it('Customer orders relation is one_to_many', () => {
    const mapping = persistenceModel.mappings['Customer']
    const rel = mapping.relations.find(r => r.property === 'orders')
    expect(rel).toBeDefined()
    expect(rel!.relationType).toBe('one_to_many')
    expect(rel!.target).toBe('Order')
  })

  it('Order customer relation is many_to_one with join column', () => {
    const mapping = persistenceModel.mappings['Order']
    const rel = mapping.relations.find(r => r.property === 'customer')
    expect(rel).toBeDefined()
    expect(rel!.relationType).toBe('many_to_one')
    expect(rel!.joinColumn).toBeDefined()
  })

  it('OrderLine maps to ORDER_LINE table', () => {
    const mapping = persistenceModel.mappings['OrderLine']
    expect(mapping.table).toBe('ORDER_LINE')
  })

  it('OrderLine quantity maps to QUANTITY column', () => {
    const mapping = persistenceModel.mappings['OrderLine']
    const field = mapping.fields.find(f => f.property === 'quantity')
    expect(field).toBeDefined()
    expect(field!.column).toBe('QUANTITY')
  })

  it('status field has enum logical type', () => {
    const mapping = persistenceModel.mappings['Order']
    const field = mapping.fields.find(f => f.property === 'status')
    expect(field).toBeDefined()
    expect(field!.logicalType).toBe('enum')
  })
})
