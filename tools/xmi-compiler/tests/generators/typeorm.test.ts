import { describe, it, expect, beforeAll } from 'vitest'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { XmiParser } from '../../src/xmi/parser/xmi-parser.js'
import { XmiToObjectTransformer } from '../../src/transformers/xmi-to-object/transformer.js'
import { ObjectToMappingTransformer } from '../../src/transformers/object-to-mapping/transformer.js'
import { TypeOrmGenerator } from '../../src/generators/orm/typeorm/generator.js'
import { DefaultNamingStrategy } from '../../src/naming/default-strategy.js'
import { DEFAULT_NAMING_CONFIG } from '../../src/config/defaults.js'
import type { ObjectModel } from '../../src/model/object/types.js'
import type { PersistenceModel } from '../../src/model/mapping/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const XMI_PATH = resolve(__dirname, '../../examples/model.xmi')

describe('TypeOrmGenerator', () => {
  let objectModel: ObjectModel
  let persistenceModel: PersistenceModel
  let entities: Map<string, string>
  let naming: DefaultNamingStrategy

  beforeAll(() => {
    const parser = new XmiParser()
    const parsed = parser.parseFile(XMI_PATH)
    const xmiTransformer = new XmiToObjectTransformer()
    objectModel = xmiTransformer.transform(parsed)

    naming = new DefaultNamingStrategy(DEFAULT_NAMING_CONFIG)
    const mappingTransformer = new ObjectToMappingTransformer(naming)
    persistenceModel = mappingTransformer.transform(objectModel)

    const generator = new TypeOrmGenerator()
    entities = generator.generate(objectModel, persistenceModel, {
      naming,
      tsFiles: DEFAULT_NAMING_CONFIG.tsFiles!,
      entitiesDir: 'entities',
      schemasDir: 'schemas',
    })
  })

  // Helper: get entity source by class name (files keyed by stem.entity.ts path)
  function src(className: string): string {
    const stem = naming.tsFileStem(className)
    const key = `${stem}.entity.ts`
    const s = entities.get(key)
    if (!s) throw new Error(`No entity file for ${className} (tried key: ${key})`)
    return s
  }

  it('generates an entity for Customer', () => {
    expect(() => src('Customer')).not.toThrow()
  })

  it('Customer entity has @Entity("CUSTOMER")', () => {
    expect(src('Customer')).toContain('@Entity("CUSTOMER")')
  })

  it('Customer entity has @PrimaryGeneratedColumn("uuid")', () => {
    expect(src('Customer')).toContain('@PrimaryGeneratedColumn("uuid")')
  })

  it('Customer firstName has @Column with FIRST_NAME', () => {
    const s = src('Customer')
    expect(s).toContain('FIRST_NAME')
    expect(s).toContain('@Column(')
  })

  it('Customer has @OneToMany for orders', () => {
    const s = src('Customer')
    expect(s).toContain('@OneToMany(')
    expect(s).toContain('Order')
  })

  it('Order entity has @Entity("ORDER")', () => {
    expect(src('Order')).toContain('@Entity("ORDER")')
  })

  it('Order has @ManyToOne for customer with @JoinColumn', () => {
    const s = src('Order')
    expect(s).toContain('@ManyToOne(')
    expect(s).toContain('@JoinColumn(')
    expect(s).toContain('Customer')
  })

  it('Order has @OneToMany for orderLines', () => {
    const s = src('Order')
    expect(s).toContain('@OneToMany(')
    expect(s).toContain('OrderLine')
  })

  it('OrderLine has @ManyToOne for product', () => {
    const s = src('OrderLine')
    expect(s).toContain('@ManyToOne(')
    expect(s).toContain('Product')
  })

  it('generated source contains typeorm import', () => {
    expect(src('Customer')).toContain("from 'typeorm'")
  })

  it('generated source has Entity class', () => {
    expect(src('Customer')).toContain('export class Customer')
  })

  it('generates entities for all non-abstract types', () => {
    const concreteTypes = objectModel.types.filter(t => !t.isAbstract).map(t => t.name)
    for (const name of concreteTypes) {
      expect(() => src(name)).not.toThrow()
    }
  })

  it('properties use definite assignment operator', () => {
    expect(src('Customer')).toContain('!:')
  })

  it('entity imports its schema from schemas dir', () => {
    const s = src('Customer')
    expect(s).toContain("from '../schemas/customer.schema'")
  })
})
