import { describe, it, expect } from 'vitest'
import { IdentifierCompressionPipeline } from '../../src/identifiers/compression-pipeline.js'
import { IdentifierShortener } from '../../src/identifiers/shortener.js'

describe('IdentifierCompressionPipeline', () => {
  const pipeline = new IdentifierCompressionPipeline(63)

  it('short names pass through unchanged', () => {
    expect(pipeline.compress('CUSTOMER')).toBe('CUSTOMER')
    expect(pipeline.compress('FK_ORDER_CUSTOMER')).toBe('FK_ORDER_CUSTOMER')
  })

  it('compresses a long FK name', () => {
    const long = 'FK_VERY_LONG_TABLE_NAME_WITH_LOTS_OF_WORDS_REFERENCES_ANOTHER_VERY_LONG_TABLE_NAME'
    const result = pipeline.compress(long)
    expect(result.length).toBeLessThanOrEqual(63)
  })

  it('is deterministic — same input always produces same output', () => {
    const long = 'FK_CUSTOMER_ACCOUNT_ORDER_REFERENCE_TRANSACTION_IDENTIFIER_CONSTRAINT'
    const r1 = pipeline.compress(long)
    const r2 = pipeline.compress(long)
    expect(r1).toBe(r2)
  })

  it('produces different results for different inputs (hash suffix differs)', () => {
    const a = 'FK_CUSTOMER_ORDERS_REFERENCE_ASSOCIATION_VERY_LONG_IDENTIFIER_A'
    const b = 'FK_CUSTOMER_ORDERS_REFERENCE_ASSOCIATION_VERY_LONG_IDENTIFIER_B'
    const ra = pipeline.compress(a)
    const rb = pipeline.compress(b)
    // Both fit
    expect(ra.length).toBeLessThanOrEqual(63)
    expect(rb.length).toBeLessThanOrEqual(63)
    // They should be different
    expect(ra).not.toBe(rb)
  })

  it('result never exceeds maxLength', () => {
    const cases = [
      'FK_CUSTOMER_ORDER_ASSOCIATION_TABLE_COLUMN_REFERENCE_VERY_LONG_NAME',
      'UQ_TRANSACTION_PAYMENT_ACCOUNT_IDENTIFIER_CONSTRAINT_UNIQUE_INDEX',
      'ORGANIZATION_MANAGEMENT_CONFIGURATION_PARAMETER_ATTRIBUTES_TABLE',
    ]
    for (const c of cases) {
      const compressed = pipeline.compress(c)
      expect(compressed.length).toBeLessThanOrEqual(63)
    }
  })
})

describe('IdentifierShortener', () => {
  const shortener = new IdentifierShortener(63)

  it('passes through short names unchanged', () => {
    expect(shortener.shorten('CUSTOMER')).toBe('CUSTOMER')
  })

  it('shortens long names to fit within limit', () => {
    const long = 'FK_EXTREMELY_LONG_TABLE_NAME_REFERENCES_ANOTHER_EXTREMELY_LONG_TABLE'
    expect(shortener.shorten(long).length).toBeLessThanOrEqual(63)
  })

  it('reports correct limit', () => {
    expect(shortener.limit).toBe(63)
  })

  it('Oracle shortener uses 128 char limit', () => {
    const oraShortener = new IdentifierShortener(128)
    const name = 'FK_CUSTOMER_ORDER_REFERENCE'
    expect(oraShortener.shorten(name)).toBe(name)
  })
})
