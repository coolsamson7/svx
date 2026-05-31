import type { CompressionStep } from '../compression-pipeline.js'

/** Default abbreviation dictionary — maps common words to short forms */
export const DEFAULT_ABBREVIATIONS: Record<string, string> = {
  CUSTOMER: 'CSTMR',
  ORDER: 'ORDR',
  ORDERS: 'ORDRS',
  PRODUCT: 'PROD',
  PRODUCTS: 'PRODS',
  ADDRESS: 'ADDR',
  ADDRESSES: 'ADDRS',
  DESCRIPTION: 'DESC',
  REFERENCE: 'REF',
  REFERENCES: 'REFS',
  NUMBER: 'NUM',
  NUMBERS: 'NUMS',
  IDENTIFIER: 'ID',
  IDENTIFIERS: 'IDS',
  AMOUNT: 'AMT',
  QUANTITY: 'QTY',
  PRICE: 'PRC',
  STATUS: 'STAT',
  TIMESTAMP: 'TS',
  CREATED: 'CRTD',
  UPDATED: 'UPDT',
  DELETED: 'DLTD',
  MODIFIED: 'MOD',
  INFORMATION: 'INFO',
  CATEGORY: 'CAT',
  CATEGORIES: 'CATS',
  MANAGEMENT: 'MGMT',
  ORGANIZATION: 'ORG',
  CONFIGURATION: 'CFG',
  PARAMETER: 'PARAM',
  PARAMETERS: 'PARAMS',
  MESSAGE: 'MSG',
  MESSAGES: 'MSGS',
  ACCOUNT: 'ACCT',
  ACCOUNTS: 'ACCTS',
  PAYMENT: 'PYMNT',
  PAYMENTS: 'PYMNTS',
  TRANSACTION: 'TXN',
  TRANSACTIONS: 'TXNS',
  ATTRIBUTE: 'ATTR',
  ATTRIBUTES: 'ATTRS',
  ASSOCIATION: 'ASSOC',
  IMPLEMENTATION: 'IMPL',
  CONSTRAINT: 'CNSTR',
  CONSTRAINTS: 'CNSTRS',
  FOREIGN: 'FK',
  PRIMARY: 'PK',
  UNIQUE: 'UQ',
  INDEX: 'IDX',
  SEQUENCE: 'SEQ',
  INVENTORY: 'INV',
  INVOICE: 'INV',
  SUPPLIER: 'SPLR',
  CUSTOMER_ORDER: 'CSTMR_ORDR',
}

/**
 * Replaces known words in an underscore-delimited identifier with shorter abbreviations.
 */
export class CompressDictionaryStep implements CompressionStep {
  private readonly abbreviations: Record<string, string>

  constructor(abbreviations: Record<string, string> = DEFAULT_ABBREVIATIONS) {
    this.abbreviations = abbreviations
  }

  compress(name: string, maxLength: number): string {
    if (name.length <= maxLength) return name

    const parts = name.split('_')
    const compressed = parts.map(part => {
      const upper = part.toUpperCase()
      const abbrev = this.abbreviations[upper]
      if (!abbrev) return part
      // Preserve casing: if original is upper, keep abbrev upper; else lower
      return part === upper ? abbrev : abbrev.toLowerCase()
    })
    return compressed.join('_')
  }
}
