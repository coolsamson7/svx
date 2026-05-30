import { describe, it, expect, beforeAll } from 'vitest'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { XmiParser } from '../../src/xmi/parser/xmi-parser.js'
import { XmiToObjectTransformer } from '../../src/transformers/xmi-to-object/transformer.js'
import { ObjectToMappingTransformer } from '../../src/transformers/object-to-mapping/transformer.js'
import { SchemaMapperGenerator } from '../../src/generators/schema/generator.js'
import { DefaultNamingStrategy } from '../../src/naming/default-strategy.js'
import { DEFAULT_NAMING_CONFIG } from '../../src/config/defaults.js'
import type { ObjectModel } from '../../src/model/object/types.js'
import type { PersistenceModel } from '../../src/model/mapping/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const XMI_PATH = resolve(__dirname, '../../examples/model.xmi')

describe('SchemaMapperGenerator', () => {
  let objectModel: ObjectModel
  let persistenceModel: PersistenceModel
  // schemaGrouping: 'one' → everything in entity-schemas.ts
  let output: string

  beforeAll(() => {
    const parser = new XmiParser()
    const parsed = parser.parseFile(XMI_PATH)
    const xmiTransformer = new XmiToObjectTransformer()
    objectModel = xmiTransformer.transform(parsed)

    const naming = new DefaultNamingStrategy(DEFAULT_NAMING_CONFIG)
    const mappingTransformer = new ObjectToMappingTransformer(naming)
    persistenceModel = mappingTransformer.transform(objectModel)

    const generator = new SchemaMapperGenerator()
    const files = generator.generate(objectModel, persistenceModel, {
      naming,
      tsFiles: { ...DEFAULT_NAMING_CONFIG.tsFiles, schemaGrouping: 'one' },
    })
    output = files.get('entity-schemas.ts')!
  })

  it('imports from @svx/common', () => {
    expect(output).toContain("from '@svx/common'")
  })

  it('imports InferObject as a type import', () => {
    expect(output).toContain("import type { InferObject } from '@svx/common'")
  })

  it('generates a schema constant for Customer', () => {
    expect(output).toContain('export const CustomerSchema = object(')
  })

  it('generates a schema constant for Order', () => {
    expect(output).toContain('export const OrderSchema = object(')
  })

  it('generates type alias for Customer', () => {
    expect(output).toContain('export type CustomerType = InferObject<typeof CustomerSchema>')
  })

  it('generates type alias for Order', () => {
    expect(output).toContain('export type OrderType = InferObject<typeof OrderSchema>')
  })

  it('includes optional() for nullable fields', () => {
    expect(output).toContain('optional(')
  })

  it('includes array() for one-to-many relations', () => {
    expect(output).toContain('array(')
  })

  it('Customer schema references OrderSchema via array', () => {
    const customerBlock = output.slice(
      output.indexOf('export const CustomerSchema'),
      output.indexOf('}, \'Customer\')') + 20,
    )
    expect(customerBlock).toContain('array(OrderSchema)')
  })

  it('Order schema references OrderLineSchema via array', () => {
    const orderBlock = output.slice(
      output.indexOf('export const OrderSchema'),
      output.indexOf('}, \'Order\')') + 20,
    )
    expect(orderBlock).toContain('array(OrderLineSchema)')
  })

  it('OrderLine appears before Order (topological order)', () => {
    const orderLinePos = output.indexOf('export const OrderLineSchema')
    const orderPos = output.indexOf('export const OrderSchema')
    expect(orderLinePos).toBeLessThan(orderPos)
  })

  it('Order appears before Customer (topological order)', () => {
    const orderPos = output.indexOf('export const OrderSchema')
    const customerPos = output.indexOf('export const CustomerSchema')
    expect(orderPos).toBeLessThan(customerPos)
  })

  it('does not include ManyToOne back-references to avoid cycles', () => {
    // Order has a ManyToOne to Customer — that should NOT appear in OrderSchema
    const orderBlock = output.slice(
      output.indexOf('export const OrderSchema'),
      output.indexOf('}, \'Order\')') + 20,
    )
    expect(orderBlock).not.toContain('CustomerSchema')
  })

  it('string fields use string()', () => {
    expect(output).toContain('string()')
  })

  it('generates schemas for all non-abstract types with mappings', () => {
    const concreteTypes = objectModel.types.filter(t => !t.isAbstract).map(t => t.name)
    for (const name of concreteTypes) {
      if (persistenceModel.mappings[name]) {
        expect(output).toContain(`export const ${name}Schema = object(`)
      }
    }
  })
})
