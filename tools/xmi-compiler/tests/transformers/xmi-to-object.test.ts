import { describe, it, expect, beforeAll } from 'vitest'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { XmiParser } from '../../src/xmi/parser/xmi-parser.js'
import { XmiToObjectTransformer } from '../../src/transformers/xmi-to-object/transformer.js'
import type { ObjectModel } from '../../src/model/object/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const XMI_PATH = resolve(__dirname, '../../examples/model.xmi')

describe('XmiToObjectTransformer', () => {
  let model: ObjectModel

  beforeAll(() => {
    const parser = new XmiParser()
    const parsed = parser.parseFile(XMI_PATH)
    const transformer = new XmiToObjectTransformer()
    model = transformer.transform(parsed)
  })

  it('parses all class types from the example XMI', () => {
    const names = model.types.map(t => t.name)
    expect(names).toContain('Customer')
    expect(names).toContain('Order')
    expect(names).toContain('OrderLine')
    expect(names).toContain('Product')
    expect(names).toContain('Address')
  })

  it('Customer has correct properties', () => {
    const customer = model.types.find(t => t.name === 'Customer')
    expect(customer).toBeDefined()

    const propNames = customer!.properties.map(p => p.name)
    expect(propNames).toContain('id')
    expect(propNames).toContain('firstName')
    expect(propNames).toContain('lastName')
    expect(propNames).toContain('email')
  })

  it('Customer id property has uuid type', () => {
    const customer = model.types.find(t => t.name === 'Customer')!
    const id = customer.properties.find(p => p.name === 'id')
    expect(id).toBeDefined()
    expect(id!.type).toBe('uuid')
  })

  it('Customer firstName has string type', () => {
    const customer = model.types.find(t => t.name === 'Customer')!
    const fn = customer.properties.find(p => p.name === 'firstName')
    expect(fn).toBeDefined()
    expect(fn!.type).toBe('string')
  })

  it('Order has orderDate with datetime type', () => {
    const order = model.types.find(t => t.name === 'Order')!
    const od = order.properties.find(p => p.name === 'orderDate')
    expect(od).toBeDefined()
    expect(od!.type).toBe('datetime')
  })

  it('Order status property is an enum type', () => {
    const order = model.types.find(t => t.name === 'Order')!
    const status = order.properties.find(p => p.name === 'status')
    expect(status).toBeDefined()
    expect(status!.isEnum).toBe(true)
  })

  it('Order has relation to OrderLine', () => {
    const order = model.types.find(t => t.name === 'Order')!
    const rel = order.relations.find(r => r.target === 'OrderLine')
    expect(rel).toBeDefined()
    expect(['one_to_many', 'many_to_one']).toContain(rel!.type)
  })

  it('OrderStatus enum has correct values', () => {
    const orderStatus = model.enums.find(e => e.name === 'OrderStatus')
    expect(orderStatus).toBeDefined()
    expect(orderStatus!.values).toContain('PENDING')
    expect(orderStatus!.values).toContain('CONFIRMED')
    expect(orderStatus!.values).toContain('SHIPPED')
    expect(orderStatus!.values).toContain('DELIVERED')
    expect(orderStatus!.values).toContain('CANCELLED')
  })

  it('OrderStatus enum has exactly 5 values', () => {
    const orderStatus = model.enums.find(e => e.name === 'OrderStatus')
    expect(orderStatus!.values).toHaveLength(5)
  })

  it('parses enums correctly', () => {
    expect(model.enums.length).toBeGreaterThan(0)
    const names = model.enums.map(e => e.name)
    expect(names).toContain('OrderStatus')
  })

  it('Customer has orders relation', () => {
    const customer = model.types.find(t => t.name === 'Customer')!
    const rel = customer.relations.find(r => r.name === 'orders')
    expect(rel).toBeDefined()
    expect(rel!.target).toBe('Order')
  })
})
