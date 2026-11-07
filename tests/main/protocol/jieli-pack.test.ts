import { describe, it, expect } from 'vitest'
import { unpackJieli, packJieli } from '../../../src/main/protocol/jieli-pack'
import { syntheticPresetBlob } from '../../fixtures/pedal-slots'

// Vetor real: payload da região 51 02 (preset ativo) capturado do hardware em
// 2026-06-11, após escrever um preset-assinatura conhecido via 09 49.
const PACKED_SIGNATURE = [
  0x01, 0x00, 0x04, 0x00, 0x10, 0x42, 0x40, 0x31,
  0x55, 0x08, 0x4d, 0x11, 0x22, 0x02, 0x0d, 0x2b,
  0x29, 0x30, 0x24, 0x18, 0x70, 0x1f, 0x00, 0x00,
]
// 21 bytes em ordem AO VIVO: amp=1, mod=0, delay=1, reverb=0, gate 0x11, ampType 2,
// gain 0x63, treble 0x55, mid 0x44, bass 0x33, vol 0x22, modFx 0x12, modSpeed 0x34,
// dlyMix 0x56, dlyTime 0x29, rvbDecay 0x18, rvbMix 0x09, irCab 3, RGB ff 00 00.
const RAW_SIGNATURE = [
  0x01, 0x00, 0x01, 0x00, 0x11, 0x02, 0x63,
  0x55, 0x44, 0x33, 0x22, 0x12, 0x34, 0x56,
  0x29, 0x18, 0x09, 0x03, 0xff, 0x00, 0x00,
]

describe('jieli-pack — cascata LSB-first 7↔8 (validado contra hardware)', () => {
  it('unpackJieli decodifica o vetor-assinatura capturado do pedal', () => {
    expect(Array.from(unpackJieli(PACKED_SIGNATURE))).toEqual(RAW_SIGNATURE)
  })

  it('packJieli é o inverso exato de unpackJieli', () => {
    const packed = packJieli(RAW_SIGNATURE)
    expect(Array.from(packed)).toEqual(PACKED_SIGNATURE)
  })

  it('round-trip para todos os valores de byte', () => {
    const raw = Array.from({ length: 7 * 37 }, (_, i) => (i * 31) & 0xff)
    expect(Array.from(unpackJieli(packJieli(raw)))).toEqual(raw)
  })

  it('round-trips a full 758-byte storage blob (A5 5A header + 36 × 21)', () => {
    const blob = new Uint8Array(758)
    blob.set([0xa5, 0x5a])
    blob.set(syntheticPresetBlob(), 2)
    // 758 is not a multiple of 7, so packing pads the last group with zeros
    const back = unpackJieli(packJieli(blob))
    expect(Array.from(back.subarray(0, 758))).toEqual(Array.from(blob))
    expect(Array.from(back.subarray(758)).every((b) => b === 0)).toBe(true)
  })
})
