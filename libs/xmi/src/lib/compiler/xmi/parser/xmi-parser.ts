/**
 * XMI parser — reads an Enterprise Architect XMI 2.1 file and produces a raw
 * intermediate structure that the xmi-to-object transformer will turn into an ObjectModel.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { XMLParser } from 'fast-xml-parser'

import type {
  XmiPackagedElement,
  XmiOwnedAttribute,
  XmiOwnedEnd,
  XmiOwnedLiteral,
  XmiGeneralization,
  XmiMemberEnd,
  XmiMultiplicityValue,
  XmiOwnedComment,
} from './xmi-types.js'

/** A normalised class description extracted from XMI */
export interface ParsedClass {
  id: string
  name: string
  isAbstract: boolean
  attributes: ParsedAttribute[]
  generalizations: string[]   // IDs of parent classes
  associationEndIds: string[] // IDs of ownedAttribute that are association ends
  packagePath: string[]       // e.g. ['com', 'example', 'user']
  tags: Record<string, string>
  description?: string
}

/** A normalised attribute extracted from XMI */
export interface ParsedAttribute {
  id: string
  name: string
  typeId?: string    // xmi:idref of the type
  typeName?: string  // inline type name or EA href type name
  isAssociationEnd: boolean
  lowerBound: string  // "0", "1"
  upperBound: string  // "1", "*", "-1"
  isNullable: boolean
  defaultValue?: string
  description?: string
  tags: Record<string, string>
}

/** A normalised association extracted from XMI */
export interface ParsedAssociation {
  id: string
  name: string
  ends: ParsedAssociationEnd[]
  tags: Record<string, string>
}

/** One end of a parsed association */
export interface ParsedAssociationEnd {
  id: string
  name?: string
  typeId?: string
  typeName?: string
  lowerBound: string
  upperBound: string
  aggregation?: string
}

/** A normalised enumeration extracted from XMI */
export interface ParsedEnum {
  id: string
  name: string
  values: string[]
  description?: string
}

/** A normalised uml:DataType extracted from XMI */
export interface ParsedDataType {
  id: string
  name: string
  baseTypeId?: string
  tags: Record<string, string>
  packagePath: string[]
  description?: string
}

/** Complete raw parse output */
export interface ParsedXmi {
  classes: ParsedClass[]
  associations: ParsedAssociation[]
  enums: ParsedEnum[]
  dataTypes: ParsedDataType[]
  /** ID → name lookup for all named elements */
  idToName: Record<string, string>
}

// ---- helpers ---------------------------------------------------------------

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return []
  return Array.isArray(v) ? v : [v]
}

function multiplicityValue(mv: XmiMultiplicityValue | undefined): string {
  if (!mv) return '1'
  return mv['@_value'] ?? '1'
}

function resolveTypeName(href: string | undefined): string | undefined {
  if (!href) return undefined
  // EA uses paths like "http://…#EAJava_String" or primitive type names
  const parts = href.split(/[/#]/)
  const last = parts[parts.length - 1]
  // Strip EA-specific prefixes like "EAJava_"
  return last.replace(/^EAJava_/, '').replace(/^EANs_/, '')
}

function extractDescription(el: XmiPackagedElement): string | undefined {
  const comments = toArray<XmiOwnedComment>(el.ownedComment as any)
  const body = comments[0]?.body
  return body ? String(body).trim() : undefined
}

function normaliseTypeName(raw: string): string {
  const map: Record<string, string> = {
    String: 'string',
    Integer: 'integer',
    Int: 'integer',
    Long: 'long',
    Double: 'decimal',
    Float: 'decimal',
    BigDecimal: 'decimal',
    Boolean: 'boolean',
    bool: 'boolean',
    UUID: 'uuid',
    Uuid: 'uuid',
    Date: 'date',
    DateTime: 'datetime',
    Timestamp: 'datetime',
    Time: 'time',
    Blob: 'binary',
    Binary: 'binary',
    Bytes: 'binary',
    Json: 'json',
    JSON: 'json',
  }
  return map[raw] ?? raw
}

// ---- main parser class -----------------------------------------------------

/**
 * Parses Enterprise Architect XMI 2.1 documents into a `ParsedXmi` structure.
 */
export class XmiParser {
  private readonly parser: XMLParser

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      isArray: (tagName: string) => {
        return [
          'packagedElement', 'ownedAttribute', 'ownedEnd',
          'memberEnd', 'ownedLiteral', 'generalization', 'taggedValue', 'ownedComment',
        ].includes(tagName)
      },
      allowBooleanAttributes: true,
    })
  }

  /** Parse XMI from a string */
  parseString(xml: string): ParsedXmi {
    const raw = this.parser.parse(xml) as any

    const idToName: Record<string, string> = {}
    const classes: ParsedClass[] = []
    const associations: ParsedAssociation[] = []
    const enums: ParsedEnum[] = []
    const dataTypes: ParsedDataType[] = []

    // Navigate to the model root — try several common XMI structures
    let elements: XmiPackagedElement[] = []
    const xmiRoot = raw['xmi:XMI'] ?? raw
    const modelNode =
      xmiRoot['uml:Model'] ??
      xmiRoot['UML:Model'] ??
      xmiRoot['Model'] ??
      xmiRoot

    if (modelNode?.packagedElement) {
      elements = toArray<XmiPackagedElement>(modelNode.packagedElement)
    }

    // Recursively collect all packaged elements, tracking package path
    const allElements: Array<{ el: XmiPackagedElement; packagePath: string[] }> = []
    const collectElements = (el: XmiPackagedElement, pkgPath: string[]) => {
      if (el['@_xmi:type'] === 'uml:Package') {
        const name = el['@_name'] ?? ''
        const childPath = name ? [...pkgPath, name] : pkgPath
        toArray<XmiPackagedElement>(el.packagedElement).forEach(child => collectElements(child, childPath))
      } else {
        allElements.push({ el, packagePath: pkgPath })
        toArray<XmiPackagedElement>(el.packagedElement).forEach(child => collectElements(child, pkgPath))
      }
    }
    elements.forEach(el => collectElements(el, []))

    // First pass: build id→name map
    for (const { el } of allElements) {
      const id = el['@_xmi:id']
      const name = el['@_name']
      if (id && name) idToName[id] = name
    }

    // Second pass: extract classes, associations, enums
    for (const { el, packagePath } of allElements) {
      const type = el['@_xmi:type']

      if (type === 'uml:Class' || type === 'uml:Interface') {
        classes.push(this.parseClass(el, idToName, packagePath))
      } else if (type === 'uml:Association' || type === 'uml:AssociationClass') {
        associations.push(this.parseAssociation(el))
      } else if (type === 'uml:Enumeration') {
        enums.push(this.parseEnum(el))
      } else if (type === 'uml:DataType') {
        dataTypes.push(this.parseDataType(el, packagePath))
      }
    }

    return { classes, associations, enums, dataTypes, idToName }
  }

  // --------------------------------------------------------------------------

  private parseClass(el: XmiPackagedElement, idToName: Record<string, string>, packagePath: string[]): ParsedClass {
    const id = el['@_xmi:id']
    const name = el['@_name']
    const isAbstract = el['@_isAbstract'] === 'true'

    const rawAttrs = toArray<XmiOwnedAttribute>(el.ownedAttribute)
    const attributes: ParsedAttribute[] = rawAttrs.map(a => this.parseAttribute(a))

    const generalizations = toArray<XmiGeneralization>(el.generalization)
      .map(g => g['@_general'])
      .filter(Boolean)

    // Association ends are attributes that have an '@_association' reference
    const associationEndIds = rawAttrs
      .filter(a => a['@_association'] !== undefined)
      .map(a => a['@_xmi:id'])

    const tags: Record<string, string> = {}
    for (const tv of toArray(el.taggedValue as any)) {
      const tag = tv['@_tag'], value = tv['@_value']
      if (tag && value !== undefined) tags[normTagKey(String(tag))] = String(value)
    }

    const description = extractDescription(el)
    return { id, name, isAbstract, attributes, generalizations, associationEndIds, packagePath, tags, description }
  }

  private parseAttribute(attr: XmiOwnedAttribute): ParsedAttribute {
    const id = attr['@_xmi:id']
    const name = attr['@_name'] ?? ''
    const isAssociationEnd = attr['@_association'] !== undefined

    // Resolve type from various locations
    let typeId: string | undefined
    let typeName: string | undefined

    if (attr.type) {
      typeId = attr.type['@_xmi:idref']
      const href = attr.type['@_href']
      typeName = attr.type['@_name'] ?? resolveTypeName(href)
    }

    if (typeName) typeName = normaliseTypeName(typeName)

    const lowerBound = multiplicityValue(
      Array.isArray(attr.lowerValue) ? attr.lowerValue[0] : attr.lowerValue
    )
    const upperBound = multiplicityValue(
      Array.isArray(attr.upperValue) ? attr.upperValue[0] : attr.upperValue
    )
    const isNullable = lowerBound === '0'

    let defaultValue: string | undefined
    const dv = Array.isArray(attr.defaultValue) ? attr.defaultValue[0] : attr.defaultValue
    if (dv?.['@_value'] !== undefined) {
      defaultValue = String(dv['@_value'])
    }

    const tags: Record<string, string> = {}
    const tvs = toArray(attr.taggedValue as any)
    for (const tv of tvs) {
      const tag = tv['@_tag']
      const value = tv['@_value']
      if (tag && value !== undefined) tags[normTagKey(String(tag))] = String(value)
    }

    const description = extractDescription(attr as any)

    return { id, name, typeId, typeName, isAssociationEnd, lowerBound, upperBound, isNullable, defaultValue, tags, description }
  }

  private parseAssociation(el: XmiPackagedElement): ParsedAssociation {
    const id = el['@_xmi:id']
    const name = el['@_name'] ?? ''

    const ownedEnds = toArray<XmiOwnedEnd>(el.ownedEnd)
    const ends: ParsedAssociationEnd[] = ownedEnds.map(end => {
      const endId = end['@_xmi:id']
      const endName = end['@_name']
      let typeId: string | undefined
      let typeName: string | undefined
      if (end['@_type']) {
        typeId = end['@_type']
      } else if (end.type) {
        typeId = end.type['@_xmi:idref']
        const href = end.type['@_href']
        typeName = end.type['@_name'] ?? resolveTypeName(href)
      }
      const lowerBound = multiplicityValue(
        Array.isArray(end.lowerValue) ? end.lowerValue[0] : end.lowerValue
      )
      const upperBound = multiplicityValue(
        Array.isArray(end.upperValue) ? end.upperValue[0] : end.upperValue
      )
      return {
        id: endId,
        name: endName,
        typeId,
        typeName,
        lowerBound,
        upperBound,
        aggregation: end['@_aggregation'],
      }
    })

    // If no ownedEnds (EA puts ends as ownedAttribute), return with empty ends
    // The transformer will resolve ends from memberEnd references
    const memberEnds = toArray<XmiMemberEnd>(el.memberEnd)
    if (ends.length === 0 && memberEnds.length >= 2) {
      // Minimal ends from memberEnd idref
      memberEnds.forEach(me => {
        const ref = me['@_xmi:idref'] ?? ''
        ends.push({ id: ref, lowerBound: '0', upperBound: '*' })
      })
    }

    const tags: Record<string, string> = {}
    for (const tv of toArray(el.taggedValue as any)) {
      const tag = tv['@_tag'], value = tv['@_value']
      if (tag && value !== undefined) tags[normTagKey(String(tag))] = String(value)
    }

    return { id, name, ends, tags }
  }

  private parseEnum(el: XmiPackagedElement): ParsedEnum {
    const id = el['@_xmi:id']
    const name = el['@_name']
    const literals = toArray<XmiOwnedLiteral>(el.ownedLiteral)
    const values = literals.map(l => l['@_name'])
    const description = extractDescription(el)
    return { id, name, values, description }
  }

  private parseDataType(el: XmiPackagedElement, packagePath: string[]): ParsedDataType {
    const id = el['@_xmi:id']
    const name = el['@_name']

    const gens = toArray<XmiGeneralization>(el.generalization)
    const baseTypeId = gens[0]?.['@_general']

    const tags: Record<string, string> = {}
    const tvs = toArray(el.taggedValue as any)
    for (const tv of tvs) {
      const tag = tv['@_tag']
      const value = tv['@_value']
      if (tag && value !== undefined) tags[normTagKey(String(tag))] = String(value)
    }

    const description = extractDescription(el)
    return { id, name, baseTypeId, tags, packagePath, description }
  }
}

/** Normalise tag keys: kebab-case → camelCase so "max-length" === "maxLength" */
function normTagKey(key: string): string {
  return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}
