import { describe, it, expect } from 'vitest'
import { SnakeCaseTransform } from '../../src/naming/strategies/snake-case.js'
import { UpperSnakeCaseTransform } from '../../src/naming/strategies/upper-snake-case.js'
import { RemoveSuffixTransform } from '../../src/naming/strategies/remove-suffix.js'
import { TransformPipeline } from '../../src/naming/strategy.js'
import { DefaultNamingStrategy } from '../../src/naming/default-strategy.js'
import { DEFAULT_NAMING_CONFIG } from '../../src/config/defaults.js'

describe('SnakeCaseTransform', () => {
  const t = new SnakeCaseTransform()

  it('converts camelCase to snake_case', () => {
    expect(t.apply('customerOrder')).toBe('customer_order')
  })

  it('converts PascalCase to snake_case', () => {
    expect(t.apply('CustomerOrder')).toBe('customer_order')
  })

  it('handles consecutive uppercase letters', () => {
    expect(t.apply('HTTPSRequest')).toBe('https_request')
  })

  it('leaves already snake_case unchanged', () => {
    expect(t.apply('customer_order')).toBe('customer_order')
  })

  it('handles single word', () => {
    expect(t.apply('Customer')).toBe('customer')
  })
})

describe('UpperSnakeCaseTransform', () => {
  const t = new UpperSnakeCaseTransform()

  it('converts CustomerOrder to CUSTOMER_ORDER', () => {
    expect(t.apply('CustomerOrder')).toBe('CUSTOMER_ORDER')
  })

  it('converts camelCase to UPPER_SNAKE', () => {
    expect(t.apply('firstName')).toBe('FIRST_NAME')
  })

  it('handles single word', () => {
    expect(t.apply('Customer')).toBe('CUSTOMER')
  })
})

describe('RemoveSuffixTransform', () => {
  const t = new RemoveSuffixTransform(['Entity', 'Dto', 'VO'])

  it('removes Entity suffix', () => {
    expect(t.apply('CustomerEntity')).toBe('Customer')
  })

  it('removes Dto suffix', () => {
    expect(t.apply('CustomerDto')).toBe('Customer')
  })

  it('removes VO suffix', () => {
    expect(t.apply('CustomerVO')).toBe('Customer')
  })

  it('leaves names without known suffix unchanged', () => {
    expect(t.apply('Customer')).toBe('Customer')
  })

  it('does not remove partial matches', () => {
    // "EntityManager" does NOT end in "Entity"
    expect(t.apply('EntityManager')).toBe('EntityManager')
  })

  it('handles multiple suffixes - uses longest match', () => {
    const t2 = new RemoveSuffixTransform(['Service', 'UserService'])
    // "UserService" should be stripped as a whole (longest match)
    expect(t2.apply('CustomerUserService')).toBe('Customer')
  })
})

describe('TransformPipeline - full pipeline', () => {
  it('CustomerEntity → CUSTOMER via RemoveSuffix + UpperSnake', () => {
    const pipeline = new TransformPipeline([
      new RemoveSuffixTransform(['Entity']),
      new UpperSnakeCaseTransform(),
    ])
    expect(pipeline.apply('CustomerEntity')).toBe('CUSTOMER')
  })

  it('orderDate → ORDER_DATE via UpperSnake', () => {
    const pipeline = new TransformPipeline([new UpperSnakeCaseTransform()])
    expect(pipeline.apply('orderDate')).toBe('ORDER_DATE')
  })
})

describe('DefaultNamingStrategy', () => {
  const strategy = new DefaultNamingStrategy(DEFAULT_NAMING_CONFIG)

  it('generates table names in UPPER_SNAKE_CASE', () => {
    expect(strategy.tableName('Customer')).toBe('CUSTOMER')
    expect(strategy.tableName('OrderLine')).toBe('ORDER_LINE')
  })

  it('strips Entity suffix from table names', () => {
    expect(strategy.tableName('CustomerEntity')).toBe('CUSTOMER')
  })

  it('generates column names in UPPER_SNAKE_CASE', () => {
    expect(strategy.columnName('firstName')).toBe('FIRST_NAME')
    expect(strategy.columnName('orderDate')).toBe('ORDER_DATE')
  })

  it('generates FK names with FK_ prefix', () => {
    const fk = strategy.foreignKeyName('CUSTOMER', 'ORDER', 'ORDER_ID')
    expect(fk).toMatch(/^FK_/)
  })

  it('generates join table names', () => {
    const jt = strategy.joinTableName('CUSTOMER', 'ADDRESS')
    expect(jt).toContain('CUSTOMER')
    expect(jt).toContain('ADDRESS')
  })
})
