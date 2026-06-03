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
