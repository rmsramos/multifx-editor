import { describe, it, expect } from 'vitest'
// @ts-expect-error - script mjs sem types
import { parseBtsnoopHeader, parseBtsnoopRecord, HEADER_SIZE, RECORD_HEADER_SIZE } from '../../scripts/decode-btsnoop.mjs'

describe('btsnoop parser', () => {
  it('exporta constantes do formato', () => {
    expect(HEADER_SIZE).toBe(16)
    expect(RECORD_HEADER_SIZE).toBe(24)
  })

  it('reconhece header válido btsnoop v1 datalink 1002 (BLE)', () => {
    const buf = Buffer.concat([
      Buffer.from('btsnoop\x00', 'binary'),
      Buffer.from([0, 0, 0, 1]),      // version 1
      Buffer.from([0, 0, 0x03, 0xea]), // datalink type 1002 (HCI UART + BLE)
    ])
    const header = parseBtsnoopHeader(buf)
    expect(header.version).toBe(1)
    expect(header.datalinkType).toBe(1002)
  })

  it('falha em header com magic inválido', () => {
    const buf = Buffer.concat([
      Buffer.from('invalid\x00', 'binary'),
      Buffer.from([0, 0, 0, 1]),
      Buffer.from([0, 0, 0, 0]),
    ])
    expect(() => parseBtsnoopHeader(buf)).toThrow(/Magic inválido/)
  })

  it('falha em header truncado', () => {
    const buf = Buffer.from('btsnoop', 'binary')
    expect(() => parseBtsnoopHeader(buf)).toThrow(/muito curto/)
  })

  it('parseia registro com payload completo', () => {
    const payload = Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x01])
    const record = Buffer.concat([
      Buffer.from([0, 0, 0, 5]),                      // origLen
      Buffer.from([0, 0, 0, 5]),                      // inclLen
      Buffer.from([0, 0, 0, 1]),                      // flags (received)
      Buffer.from([0, 0, 0, 0]),                      // cumDrops
      Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),          // timestamp 0
      payload,
    ])
    const { rec, consumed } = parseBtsnoopRecord(record, 0)
    expect(rec.origLen).toBe(5)
    expect(rec.inclLen).toBe(5)
    expect(rec.flags).toBe(1)
    expect(rec.payload).toEqual(payload)
    expect(consumed).toBe(24 + 5)
  })

  it('parseia registros consecutivos com offset', () => {
    const rec1 = Buffer.concat([
      Buffer.from([0, 0, 0, 2]),
      Buffer.from([0, 0, 0, 2]),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
      Buffer.from([0xaa, 0xbb]),
    ])
    const rec2 = Buffer.concat([
      Buffer.from([0, 0, 0, 3]),
      Buffer.from([0, 0, 0, 3]),
      Buffer.from([0, 0, 0, 1]),
      Buffer.from([0, 0, 0, 0]),
      Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]),
      Buffer.from([0x11, 0x22, 0x33]),
    ])
    const combined = Buffer.concat([rec1, rec2])
    const r1 = parseBtsnoopRecord(combined, 0)
    const r2 = parseBtsnoopRecord(combined, r1.consumed)
    expect(r1.rec.payload).toEqual(Buffer.from([0xaa, 0xbb]))
    expect(r2.rec.payload).toEqual(Buffer.from([0x11, 0x22, 0x33]))
    expect(r2.rec.flags).toBe(1)
  })

  it('falha em registro truncado', () => {
    const truncated = Buffer.from([0, 0, 0, 5])
    expect(() => parseBtsnoopRecord(truncated, 0)).toThrow(/truncado/)
  })

  it('timestamp big-endian de 64 bits', () => {
    const record = Buffer.concat([
      Buffer.from([0, 0, 0, 0]),                              // origLen
      Buffer.from([0, 0, 0, 0]),                              // inclLen
      Buffer.from([0, 0, 0, 0]),                              // flags
      Buffer.from([0, 0, 0, 0]),                              // cumDrops
      Buffer.from([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00]), // timestamp 2^32
    ])
    const { rec } = parseBtsnoopRecord(record, 0)
    expect(rec.timestamp).toBe(1n << 32n)
  })
})
