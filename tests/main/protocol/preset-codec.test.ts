import { describe, it, expect } from 'vitest'
import {
  createDefaultPreset,
  encodePreset,
  decodePreset,
  decodeAllPresets,
  encodeAllPresets,
  PRESET_BYTE_LENGTH,
} from '../../../src/main/protocol/preset-codec'
import { AMP_TYPES } from '@shared/constants'
import { syntheticPresetBlob } from '../../fixtures/pedal-slots'

// Layout dos 21 bytes — CONFIRMADO contra o app oficial M-EFCS (Tank-Gv2) em 2026-06-10,
// cruzando o export do device com os valores exibidos na tela. Ver docs/protocol/usb-sysex.md.
//   0=reverb.en 1=mod.en 2=delay.en 3=amp.en
//   4=noiseGate 5=ampType 6=gain 7=treble 8=middle 9=bass 10=volume
//   11=mod.fx 12=mod.speed 13=delay.mix 14=delay.time 15=reverb.decay 16=reverb.mix
//   17=irCab(0-8) 18,19,20=R,G,B
// Export real do device: preset 1B salvo com valores distintos (tela: GATE52 AMPTYPE4 GAIN105
// TREBLE128 MIDDLE61 BASS4 VOL78 RVBMIX25 RVBDEC19 DLYTIME64 DLYMIX40 IRCAB7; app exibe byte+1).
const DEVICE_1B = [1, 0, 1, 1, 52, 3, 104, 127, 60, 3, 78, 0, 0, 127, 63, 18, 24, 7, 254, 254, 126]

describe('preset-codec (21 bytes, layout confirmado no device)', () => {
  it('PRESET_BYTE_LENGTH = 21', () => {
    expect(PRESET_BYTE_LENGTH).toBe(21)
  })

  it('decodifica o preset 1B do device com a semântica correta dos knobs', () => {
    const p = decodePreset(Uint8Array.from(DEVICE_1B), 1, 'B')
    expect(p.reverb.enabled).toBe(true) // byte0
    expect(p.mod.enabled).toBe(false) // byte1
    expect(p.delay.enabled).toBe(true) // byte2
    expect(p.amp.enabled).toBe(true) // byte3
    expect(p.noiseGate).toBe(52) // byte4
    expect(p.amp.type).toBe(AMP_TYPES[3]) // byte5
    expect(p.amp.gain).toBe(104) // byte6
    expect(p.amp.treble).toBe(127) // byte7
    expect(p.amp.middle).toBe(60) // byte8
    expect(p.amp.bass).toBe(3) // byte9
    expect(p.amp.volume).toBe(78) // byte10
    expect(p.mod.fx).toBe(0) // byte11
    expect(p.mod.speed).toBe(0) // byte12
    expect(p.delay.mix).toBe(127) // byte13
    expect(p.delay.time).toBe(63) // byte14
    expect(p.reverb.decay).toBe(18) // byte15
    expect(p.reverb.mix).toBe(24) // byte16
    expect(p.irCab).toBe(7) // byte17
    expect(p.color).toEqual({ r: 254, g: 254, b: 126 }) // bytes 18-20
  })

  it('re-encoda o preset 1B de volta para os mesmos 21 bytes', () => {
    const p = decodePreset(Uint8Array.from(DEVICE_1B), 1, 'B')
    expect(Array.from(encodePreset(p))).toEqual(DEVICE_1B)
  })

  it('round-trips a synthetic 36-preset blob byte for byte', () => {
    const data = syntheticPresetBlob()
    const reencoded = encodeAllPresets(decodeAllPresets(data))
    expect(Array.from(reencoded)).toEqual(Array.from(data))
  })

  it('decodes 36 synthetic presets with irCab in 0-8', () => {
    const presets = decodeAllPresets(syntheticPresetBlob())
    expect(presets).toHaveLength(36)
    for (const p of presets) {
      expect(p.irCab).toBeGreaterThanOrEqual(0)
      expect(p.irCab).toBeLessThanOrEqual(8)
      expect(p.amp.type).not.toBeUndefined()
    }
  })

  it('cria um preset padrão coerente', () => {
    const p = createDefaultPreset(2, 'C')
    expect(p.bank).toBe(2)
    expect(p.slot).toBe('C')
    expect(p.amp.type).toBe(AMP_TYPES[0])
    expect(p.noiseGate).toBe(0)
  })

  it('clampa parâmetros 0-127 e cor 0-255', () => {
    const p = createDefaultPreset(1, 'A')
    p.amp.gain = 200
    p.noiseGate = -5
    p.color.r = 300
    const d = decodePreset(encodePreset(p), 1, 'A')
    expect(d.amp.gain).toBe(127)
    expect(d.noiseGate).toBe(0)
    expect(d.color.r).toBe(255)
  })
})
