import type { Preset, PresetSlot } from '../../shared/types/preset'
import { AMP_TYPES, PARAM_RANGE } from '../../shared/constants'

// Layout dos 21 bytes por preset — bytes 4-20 confirmados contra o app oficial
// M-EFCS (Tank-Gv2, 2026-06-10). Enables 0-3 CORRIGIDOS em 2026-06-11 contra o
// pedal físico: 2A de fábrica = `01 01 00 00` e o pedal liga AMP+MOD ⇒ byte 0 é
// AMP (não REVERB). A ordem é a MESMA do espaço de escrita ao vivo — não existem
// duas ordens. O endereço de escrita 09 49 == este offset de byte.
// Ver docs/protocol/usb-sysex.md.
//
//   byte  campo
//   0     amp.enabled
//   1     mod.enabled
//   2     delay.enabled
//   3     reverb.enabled
//   4     noiseGate (0-127)
//   5     amp.type (0-8)
//   6     amp.gain
//   7     amp.treble
//   8     amp.middle
//   9     amp.bass
//   10    amp.volume
//   11    mod.fx      (exibido 0-40 em blocos: tipo+quantidade)
//   12    mod.speed
//   13    delay.mix   (exibido 0-40 em blocos)
//   14    delay.time
//   15    reverb.decay (exibido 0-40 no app)
//   16    reverb.mix
//   17    irCab (índice 0-8)
//   18-20 cor RGB

function clamp(value: number): number {
  return Math.max(PARAM_RANGE.min, Math.min(PARAM_RANGE.max, Math.round(value)))
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

export const PRESET_BYTE_LENGTH = 21

export function createDefaultPreset(bank: number, slot: PresetSlot): Preset {
  return {
    bank,
    slot,
    noiseGate: 0,
    reverb: { enabled: false, mix: 64, decay: 20 },
    delay: { enabled: false, time: 64, mix: 20 },
    mod: { enabled: false, speed: 64, fx: 64 },
    amp: { enabled: true, type: AMP_TYPES[0], gain: 64, treble: 64, middle: 64, bass: 64, volume: 64 },
    irCab: 0,
    color: { r: 0, g: 0, b: 255 },
  }
}

export function encodePreset(preset: Preset): Uint8Array {
  const b = new Uint8Array(PRESET_BYTE_LENGTH)
  b[0] = preset.amp.enabled ? 1 : 0
  b[1] = preset.mod.enabled ? 1 : 0
  b[2] = preset.delay.enabled ? 1 : 0
  b[3] = preset.reverb.enabled ? 1 : 0
  b[4] = clamp(preset.noiseGate)
  b[5] = Math.max(0, AMP_TYPES.indexOf(preset.amp.type))
  b[6] = clamp(preset.amp.gain)
  b[7] = clamp(preset.amp.treble)
  b[8] = clamp(preset.amp.middle)
  b[9] = clamp(preset.amp.bass)
  b[10] = clamp(preset.amp.volume)
  b[11] = clamp(preset.mod.fx)
  b[12] = clamp(preset.mod.speed)
  b[13] = clamp(preset.delay.mix)
  b[14] = clamp(preset.delay.time)
  b[15] = clamp(preset.reverb.decay)
  b[16] = clamp(preset.reverb.mix)
  b[17] = clampByte(preset.irCab)
  b[18] = clampByte(preset.color.r)
  b[19] = clampByte(preset.color.g)
  b[20] = clampByte(preset.color.b)
  return b
}

export function decodePreset(b: Uint8Array, bank: number, slot: PresetSlot): Preset {
  return {
    bank,
    slot,
    noiseGate: clamp(b[4]),
    reverb: { enabled: b[3] === 1, mix: clamp(b[16]), decay: clamp(b[15]) },
    delay: { enabled: b[2] === 1, time: clamp(b[14]), mix: clamp(b[13]) },
    mod: { enabled: b[1] === 1, fx: clamp(b[11]), speed: clamp(b[12]) },
    amp: {
      enabled: b[0] === 1,
      type: AMP_TYPES[b[5]] ?? AMP_TYPES[0],
      gain: clamp(b[6]),
      treble: clamp(b[7]),
      middle: clamp(b[8]),
      bass: clamp(b[9]),
      volume: clamp(b[10]),
    },
    irCab: clampByte(b[17]),
    color: { r: clampByte(b[18]), g: clampByte(b[19]), b: clampByte(b[20]) },
  }
}

export function decodeAllPresets(data: Uint8Array): Preset[] {
  const expectedLength = 36 * PRESET_BYTE_LENGTH
  if (data.length < expectedLength) {
    throw new Error(`Dados insuficientes: esperado ${expectedLength} bytes, recebido ${data.length}`)
  }
  const slots: PresetSlot[] = ['A', 'B', 'C', 'D']
  const presets: Preset[] = []
  for (let i = 0; i < 36; i++) {
    const offset = i * PRESET_BYTE_LENGTH
    const bank = Math.floor(i / 4) + 1
    presets.push(decodePreset(data.subarray(offset, offset + PRESET_BYTE_LENGTH), bank, slots[i % 4]))
  }
  return presets
}

export function encodeAllPresets(presets: Preset[]): Uint8Array {
  if (presets.length !== 36) {
    throw new Error(`Número de presets inválido: esperado 36, recebido ${presets.length}`)
  }
  const data = new Uint8Array(36 * PRESET_BYTE_LENGTH)
  for (let i = 0; i < 36; i++) data.set(encodePreset(presets[i]), i * PRESET_BYTE_LENGTH)
  return data
}
