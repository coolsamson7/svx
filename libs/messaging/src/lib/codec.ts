import { getImplementingSchema } from '@svx/common'

/**
 * DI token holding the module-level "validate events" flag. <code>MessagingModule.forRoot({ validate })</code>
 * provides it; the transport factories inject it to decide whether to wrap the codec in a
 * {@link ValidatingCodec}.
 */
export const VALIDATE_EVENTS = Symbol('svx:messaging:validate-events')

/**
 * A <code>Codec</code> serializes event objects to and from the wire format used by a transport.
 * The default {@link JsonCodec} uses UTF-8 JSON; other codecs (e.g. CBOR) can be slotted in
 * without touching the transport or the event API.
 */
export interface Codec {
  encode(value: unknown): Uint8Array

  decode<T>(bytes: Uint8Array, type: { prototype: T }): T
}

/**
 * Default {@link Codec} based on UTF-8 encoded JSON. On decode the parsed plain object is
 * re-attached to the event class prototype so handlers receive a real instance of the event type.
 */
export class JsonCodec implements Codec {
  private readonly encoder = new TextEncoder()
  private readonly decoder = new TextDecoder()

  encode(value: unknown): Uint8Array {
    return this.encoder.encode(JSON.stringify(value))
  }

  decode<T>(bytes: Uint8Array, type: { prototype: T }): T {
    const parsed = JSON.parse(this.decoder.decode(bytes))

    return Object.assign(Object.create(type.prototype as object), parsed) as T
  }
}

/** Minimal shape of a validatable schema (cf. <code>Type.validate</code> in @svx/common). */
interface ValidatableSchema {
  validate(value: unknown): void
}

/**
 * A {@link Codec} that wraps another codec and validates the event against the schema declared on
 * its class via <code>@Implements(schema)</code> — the same mechanism used for service DTOs. It is
 * the non-bypassable choke point: every encode (outbound) and decode (inbound) is checked, so no
 * malformed event reaches the wire or a handler. Events without an <code>@Implements</code> schema
 * pass through unchecked.
 *
 * Enable per transport: <code>natsTransport({ servers, codec: new ValidatingCodec() })</code>.
 * On a violation the underlying schema throws <code>ValidationError</code>.
 */
export class ValidatingCodec implements Codec {
  constructor(private readonly inner: Codec = new JsonCodec()) {}

  encode(value: unknown): Uint8Array {
    if (value != null) this.schemaFor((value as object).constructor)?.validate(value)

    return this.inner.encode(value)
  }

  decode<T>(bytes: Uint8Array, type: { prototype: T }): T {
    const value = this.inner.decode(bytes, type)

    this.schemaFor(type as unknown as Function)?.validate(value)

    return value
  }

  private schemaFor(ctor: Function): ValidatableSchema | undefined {
    const schema = getImplementingSchema(ctor) as ValidatableSchema | undefined

    return schema && typeof schema.validate === 'function' ? schema : undefined
  }
}
