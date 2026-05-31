/**
 * XMI → ObjectModel transformer.
 * Converts the raw ParsedXmi structure into a clean ObjectModel.
 */

import type { ParsedXmi, ParsedClass, ParsedAttribute, ParsedAssociation } from '../../xmi/parser/xmi-parser.js'
import type {
  ObjectModel, ObjectType, Property, Relation, EnumType, DataType, PrimitiveType,
} from '../../model/object/types.js'

const PRIMITIVE_TYPES = new Set<string>([
  'string', 'integer', 'long', 'decimal', 'boolean',
  'uuid', 'datetime', 'date', 'time', 'binary', 'json',
])

function isPrimitive(type: string): type is PrimitiveType {
  return PRIMITIVE_TYPES.has(type)
}

const PRIMITIVE_NAME_MAP: Record<string, string> = {
  String: 'string', Integer: 'integer', Int: 'integer',
  Long: 'long', Double: 'decimal', Float: 'decimal', BigDecimal: 'decimal',
  Boolean: 'boolean', bool: 'boolean', UUID: 'uuid', Uuid: 'uuid',
  Date: 'date', DateTime: 'datetime', Timestamp: 'datetime',
  Time: 'time', Blob: 'binary', Binary: 'binary', Bytes: 'binary',
  Json: 'json', JSON: 'json',
}

function multiplicityIsMany(upper: string): boolean {
  return upper === '*' || upper === '-1' || (Number(upper) > 1)
}

/**
 * Transforms a ParsedXmi into a clean ObjectModel.
 */
export class XmiToObjectTransformer {
  transform(parsed: ParsedXmi): ObjectModel {
    const enumIds = new Set(parsed.enums.map(e => e.id))
    const enumNames = new Set(parsed.enums.map(e => e.name))

    // Build DataType lookup maps
    const dataTypeById = new Map<string, string>()   // id → name
    const dataTypeNames = new Set<string>()
    for (const dt of parsed.dataTypes) {
      dataTypeById.set(dt.id, dt.name)
      dataTypeNames.add(dt.name)
    }

    // Build id → class map
    const classById = new Map<string, ParsedClass>()
    for (const cls of parsed.classes) {
      classById.set(cls.id, cls)
    }

    // Build id → enum name map
    const enumById = new Map<string, string>()
    for (const en of parsed.enums) {
      enumById.set(en.id, en.name)
    }

    // Collect all association-end attribute IDs (to skip them as plain properties)
    const assocEndAttrIds = new Set<string>()
    for (const cls of parsed.classes) {
      for (const id of cls.associationEndIds) {
        assocEndAttrIds.add(id)
      }
    }

    const types: ObjectType[] = []

    for (const cls of parsed.classes) {
      // Resolve supertype
      let superType: string | undefined
      if (cls.generalizations.length > 0) {
        const parentId = cls.generalizations[0]
        superType = parsed.idToName[parentId] ?? classById.get(parentId)?.name
      }

      // --- Properties (non-association attributes) ---
      const properties: Property[] = []
      for (const attr of cls.attributes) {
        if (attr.isAssociationEnd) continue
        if (!attr.name) continue

        const typeName = this.resolveAttributeType(attr, parsed.idToName, enumById, dataTypeById)
        const isEnum = enumNames.has(typeName) || enumIds.has(attr.typeId ?? '')
        const isCollection = multiplicityIsMany(attr.upperBound)

        const property: Property = {
          name: attr.name,
          type: typeName as PrimitiveType,
          isEnum: isEnum || undefined,
          isCollection: isCollection || undefined,
          isNullable: attr.isNullable,
          defaultValue: attr.defaultValue,
          tags: Object.keys(attr.tags).length > 0 ? attr.tags : undefined,
        }
        properties.push(property)
      }

      // --- Relations from association ends owned by this class ---
      const relations: Relation[] = []
      for (const attr of cls.attributes) {
        if (!attr.isAssociationEnd) continue
        if (!attr.name) continue

        const targetId = attr.typeId
        const targetName = targetId
          ? (parsed.idToName[targetId] ?? classById.get(targetId)?.name)
          : attr.typeName

        if (!targetName) continue

        const isMany = multiplicityIsMany(attr.upperBound)
        // We'll determine the full relation type when we cross-reference
        // For now record as provisional — the full type will be assigned in a second pass
        relations.push({
          name: attr.name,
          type: isMany ? 'one_to_many' : 'many_to_one', // provisional
          target: targetName,
          isOwning: true, // provisional
        })
      }

      types.push({
        name: cls.name,
        superType,
        isAbstract: cls.isAbstract || undefined,
        properties,
        relations,
        packagePath: cls.packagePath,
        description: cls.description,
      })
    }

    // Second pass: add relations from ownedEnd-style associations (re-emitted XMI)
    this.addOwnedEndRelations(types, parsed.associations, parsed.idToName, assocEndAttrIds)

    // Third pass: resolve proper relation types using association metadata
    this.resolveRelationTypes(types, parsed.associations, parsed.idToName, parsed.classes)

    // Build enums
    const enums: EnumType[] = parsed.enums.map(e => ({
      name: e.name,
      values: e.values,
      description: e.description,
    }))

    // Build DataTypes — resolve baseType from idToName
    const dataTypes: DataType[] = []
    for (const dt of parsed.dataTypes) {
      const baseTypeName = dt.baseTypeId
        ? (parsed.idToName[dt.baseTypeId] ?? dt.baseTypeId)
        : 'string'
      const baseType = isPrimitive(baseTypeName) ? baseTypeName : 'string'
      dataTypes.push({ name: dt.name, baseType, tags: dt.tags, packagePath: dt.packagePath, description: dt.description })
    }

    return { types, enums, dataTypes }
  }

  /**
   * Resolve the type name of an attribute from its typeId, typeName, or href.
   */
  private resolveAttributeType(
    attr: ParsedAttribute,
    idToName: Record<string, string>,
    enumById: Map<string, string>,
    dataTypeById: Map<string, string>,
  ): string {
    if (attr.typeId) {
      const fromEnum = enumById.get(attr.typeId)
      if (fromEnum) return fromEnum
      const fromDataType = dataTypeById.get(attr.typeId)
      if (fromDataType) return fromDataType
      const fromId = idToName[attr.typeId]
      if (fromId) return PRIMITIVE_NAME_MAP[fromId] ?? fromId
    }
    if (attr.typeName) return attr.typeName
    return 'string'
  }

  /**
   * Creates relations from ownedEnd-style associations (produced by the editor emitter).
   * EA-style XMI uses memberEnd/@_association refs; the editor emitter uses ownedEnd elements.
   * This pass handles the latter case so round-tripped models compile correctly.
   */
  private addOwnedEndRelations(
    types: ObjectType[],
    associations: ParsedAssociation[],
    idToName: Record<string, string>,
    processedEndIds: Set<string>,
  ): void {
    const typeByName = new Map<string, ObjectType>()
    for (const t of types) typeByName.set(t.name, t)

    for (const assoc of associations) {
      if (assoc.ends.length < 2) continue
      const [end0, end1] = assoc.ends

      // Skip memberEnd-style associations (already captured from @_association ownedAttributes)
      if (processedEndIds.has(end0.id) || processedEndIds.has(end1.id)) continue
      if (!end0.typeId || !end1.typeId) continue

      const nameA = idToName[end0.typeId]
      const nameB = idToName[end1.typeId]
      if (!nameA || !nameB) continue

      const typeA = typeByName.get(nameA)
      const typeB = typeByName.get(nameB)
      if (!typeA || !typeB) continue

      // ownedEnd semantics: end[i].role is the navigation property name on the OTHER class.
      // end[0] with type=A, role=R, upper=U → property R on class B, pointing to A with multiplicity U
      // end[1] with type=B, role=R, upper=U → property R on class A, pointing to B with multiplicity U
      if (end0.name) {
        const exists = typeB.relations.find(r => r.name === end0.name && r.target === nameA)
        if (!exists) {
          typeB.relations.push({
            name: end0.name,
            type: multiplicityIsMany(end0.upperBound) ? 'one_to_many' : 'many_to_one',
            target: nameA,
            isOwning: true,
          })
        }
      }
      if (end1.name) {
        const exists = typeA.relations.find(r => r.name === end1.name && r.target === nameB)
        if (!exists) {
          typeA.relations.push({
            name: end1.name,
            type: multiplicityIsMany(end1.upperBound) ? 'one_to_many' : 'many_to_one',
            target: nameB,
            isOwning: true,
          })
        }
      }
    }
  }

  /**
   * Use parsed association data to refine relation types (one-to-many, many-to-many etc.)
   * and to determine which side is owning.
   */
  private resolveRelationTypes(
    types: ObjectType[],
    associations: ParsedAssociation[],
    idToName: Record<string, string>,
    classes: ParsedClass[],
  ): void {
    // Build lookup: class name → ObjectType
    const typeByName = new Map<string, ObjectType>()
    for (const t of types) typeByName.set(t.name, t)

    // Build lookup: class name → ParsedClass
    const parsedByName = new Map<string, ParsedClass>()
    for (const c of classes) parsedByName.set(c.name, c)

    // Track processed (ownerType.name, rel.name) pairs to avoid double-resolution
    const resolved = new Set<string>()

    // For each ObjectType, try to match its relations to other types' relations
    for (const ownerType of types) {
      for (const rel of ownerType.relations) {
        const key = `${ownerType.name}.${rel.name}`
        if (resolved.has(key)) continue
        resolved.add(key)

        const targetType = typeByName.get(rel.target)
        if (!targetType) continue

        // Find the inverse relation on the target (if any)
        const inverse = targetType.relations.find(r => r.target === ownerType.name)

        const ownerIsMany = rel.type === 'one_to_many'
        const inverseIsMany = inverse ? inverse.type === 'one_to_many' : false

        if (inverse) resolved.add(`${rel.target}.${inverse.name}`)

        if (ownerIsMany && inverseIsMany) {
          rel.type = 'many_to_many'
          rel.isOwning = true
          if (inverse) {
            inverse.type = 'many_to_many'
            inverse.isOwning = false
            inverse.mappedBy = rel.name
          }
        } else if (ownerIsMany && !inverseIsMany) {
          rel.type = 'one_to_many'
          rel.isOwning = false
          if (inverse) {
            inverse.type = 'many_to_one'
            inverse.isOwning = true
            rel.mappedBy = inverse.name
          }
        } else if (!ownerIsMany && inverseIsMany) {
          rel.type = 'many_to_one'
          rel.isOwning = true
          if (inverse) {
            inverse.type = 'one_to_many'
            inverse.isOwning = false
            inverse.mappedBy = rel.name
          }
        } else {
          // one-to-one: first encountered is owning
          rel.type = 'one_to_one'
          rel.isOwning = true
          if (inverse) {
            inverse.type = 'one_to_one'
            inverse.isOwning = false
            inverse.mappedBy = rel.name
          }
        }
      }
    }
  }
}
