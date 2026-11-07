import { describe, it, expect } from 'vitest'
import { buildStoredPresetRead, parseStoredPresets, parseDiscoveryReply,
  buildStatusRead,
  parsePedalStatus,
  buildCcClick,
  nextClickToward,
  SYSTEM_MODE_CC,
  buildBypass,
} from '../../../src/main/protocol/mvave-codec'
import { PEDAL_SLOTS } from '../../fixtures/pedal-slots'
import {
  mvaveWriteChecksum,
  buildParamWrite,
  buildDiscovery,
  buildPresetSave,
  buildFlashCommit,
  isAck,
  parseSysexFrames,
  presetToLiveBytes,
  PRESET_PARAM_ADDRESSES,
  buildActivePresetRead,
  parseActivePreset,
  liveBytesToPreset,
} from '../../../src/main/protocol/mvave-codec'
import { createDefaultPreset, encodePreset, decodePreset } from '../../../src/main/protocol/preset-codec'

// Amostras REAIS capturadas do app oficial M-EFCS via usbmon (2026-06-10).
// Família de escrita de parâmetro (tipo 0x11). Frame: F0 00 32 <body> ck1 ck2 F7,
// onde body começa em 09 49. Ver docs/protocol/usb-sysex.md.
const SAMPLES: Array<{ body: number[]; ck: [number, number] }> = [
  { body: [0x09, 0x49, 0, 0, 0, 0x02, 0x05, 0, 0, 0, 0x11, 0, 0, 0, 0x00], ck: [0x4a, 0x03] },
  { body: [0x09, 0x49, 0, 0, 0, 0x02, 0x06, 0, 0, 0, 0x11, 0, 0, 0, 0x27], ck: [0x7a, 0x02] },
  { body: [0x09, 0x49, 0, 0, 0, 0x02, 0x08, 0, 0, 0, 0x11, 0, 0, 0, 0x4c], ck: [0x2c, 0x02] },
  { body: [0x09, 0x49, 0, 0, 0, 0x02, 0x0a, 0, 0, 0, 0x11, 0, 0, 0, 0x64], ck: [0x78, 0x01] },
  { body: [0x09, 0x49, 0, 0, 0, 0x02, 0x11, 0, 0, 0, 0x11, 0, 0, 0, 0x07], ck: [0x24, 0x03] },
]

describe('mvave-codec — checksum de escrita (validado contra captura real)', () => {
  it('reproduz o checksum exato de todas as amostras capturadas', () => {
    for (const s of SAMPLES) {
      expect(mvaveWriteChecksum(s.body)).toEqual(s.ck)
    }
  })

  it('checksum sempre cabe em 7 bits (requisito SysEx)', () => {
    for (const s of SAMPLES) {
      const [c1, c2] = mvaveWriteChecksum(s.body)
      expect(c1).toBeLessThan(0x80)
      expect(c2).toBeLessThan(0x80)
    }
  })

  it('monta o frame SysEx completo de escrita de parâmetro com header e F7', () => {
    // addr 0x06 (ampGain), valor 0x27 → deve bater com a amostra real
    const frame = buildParamWrite(0x06, 0x27)
    expect(frame[0]).toBe(0xf0)
    expect(Array.from(frame.slice(1, 3))).toEqual([0x00, 0x32]) // manufacturer id
    expect(frame[frame.length - 1]).toBe(0xf7)
    // …09 49 00 00 00 02 06 00 00 00 11 00 00 00 27 7a 02 f7
    expect(Array.from(frame)).toEqual([
      0xf0, 0x00, 0x32, 0x09, 0x49, 0, 0, 0, 0x02, 0x06, 0, 0, 0, 0x11, 0, 0, 0, 0x27, 0x7a, 0x02, 0xf7,
    ])
  })
})

describe('mvave-codec — comandos e parsing (validados contra captura real)', () => {
  it('buildDiscovery reproduz o comando exato que o app envia', () => {
    expect(Array.from(buildDiscovery())).toEqual([
      0xf0, 0x00, 0x32, 0x45, 0x00, 0x00, 0x00, 0x40, 0x7f, 0xf7,
    ])
  })

  it('isAck reconhece o ACK 01 08 do device e rejeita outros frames', () => {
    const ack = [0xf0, 0x00, 0x32, 0x01, 0x08, 0, 0, 0, 0, 0x7f, 0x01, 0xf7]
    expect(isAck(ack)).toBe(true)
    expect(isAck(buildDiscovery())).toBe(false)
    expect(isAck([0xf0, 0x00, 0x32, 0x0d, 0x61, 0xf7])).toBe(false)
  })

  it('parseSysexFrames separa múltiplos frames F0..F7 de um stream', () => {
    // resposta de discovery seguida de um ACK, grudados (como o dump do amidi)
    const stream = [
      0xf0, 0x00, 0x32, 0x45, 0x58, 0x01, 0xf7,
      0xf0, 0x00, 0x32, 0x01, 0x08, 0x00, 0x00, 0x00, 0x00, 0x7f, 0x01, 0xf7,
    ]
    const frames = parseSysexFrames(stream)
    expect(frames).toHaveLength(2)
    expect(frames[0][4]).toBe(0x58) // resposta de discovery
    expect(isAck(frames[1])).toBe(true)
  })

})

describe('presetToLiveBytes — espaço de endereços da escrita ao vivo', () => {
  // Confirmado no hardware (2026-06-11): addr 0 = AMP, 1 = MOD, 2 = DELAY, 3 = REVERB —
  // a MESMA ordem do registro de preset (a "ordem de arquivo" divergente era erro do codec).
  it('addr 0 recebe amp.enabled e addr 3 recebe reverb.enabled', () => {
    const preset = createDefaultPreset(1, 'A')
    preset.amp.enabled = true
    preset.reverb.enabled = false
    preset.mod.enabled = true
    preset.delay.enabled = false
    const live = presetToLiveBytes(preset)
    expect(live[0x00]).toBe(1) // AMP
    expect(live[0x01]).toBe(1) // MOD
    expect(live[0x02]).toBe(0) // DELAY
    expect(live[0x03]).toBe(0) // REVERB
  })

  it('bytes 4..17 idênticos ao encodePreset; cor 18-20 é value>>1 (preview 7-bit)', () => {
    const preset = createDefaultPreset(1, 'A')
    preset.color = { r: 255, g: 100, b: 1 }
    const file = encodePreset(preset)
    const live = presetToLiveBytes(preset)
    for (let i = 4; i <= 17; i++) {
      expect(live[i]).toBe(file[i])
    }
    expect(live[0x12]).toBe(255 >> 1) // 127
    expect(live[0x13]).toBe(100 >> 1) // 50
    expect(live[0x14]).toBe(1 >> 1) // 0
  })
})

describe('mvave-codec — modos de sistema (afinador)', () => {
  it('buildCcClick produz press 7F e release 00 em hex MIDI', () => {
    expect(buildCcClick(SYSTEM_MODE_CC.normalLive)).toEqual({ press: 'B0 1A 7F', release: 'B0 1A 00' })
    expect(buildCcClick(SYSTEM_MODE_CC.liveTuner)).toEqual({ press: 'B0 1B 7F', release: 'B0 1B 00' })
  })

  it('nextClickToward escolhe o CC para andar 1 passo na linha', () => {
    // normal -CC26- live -CC27- tuner
    expect(nextClickToward('normal', 'tuner')).toBe(SYSTEM_MODE_CC.normalLive) // sobe p/ live
    expect(nextClickToward('live', 'tuner')).toBe(SYSTEM_MODE_CC.liveTuner)
    expect(nextClickToward('tuner', 'normal')).toBe(SYSTEM_MODE_CC.liveTuner) // desce p/ live
    expect(nextClickToward('live', 'normal')).toBe(SYSTEM_MODE_CC.normalLive)
    expect(nextClickToward('tuner', 'tuner')).toBeNull()
  })

  it('buildBypass(índice 32) reproduz os frames capturados de on/off', () => {
    expect(Array.from(buildBypass(true, 32))).toEqual([
      0xf0, 0x00, 0x32, 0x09, 0x49, 0x00, 0x00, 0x00, 0x02,
      0x20, 0x00, 0x00, 0x08, 0x1e, 0x00, 0x00, 0x00, 0x7f, 0x75, 0x03, 0xf7,
    ])
    expect(Array.from(buildBypass(false, 32))).toEqual([
      0xf0, 0x00, 0x32, 0x09, 0x49, 0x00, 0x00, 0x00, 0x02,
      0x20, 0x00, 0x00, 0x00, 0x1e, 0x00, 0x00, 0x00, 0x7f, 0x77, 0x03, 0xf7,
    ])
  })

  it('buildBypass é relativo ao índice (validado ao vivo no índice 0)', () => {
    // índice 0 (1A): addr [00 00 00 08/00], ck = (565/567) − 0
    expect(Array.from(buildBypass(true, 0))).toEqual([
      0xf0, 0x00, 0x32, 0x09, 0x49, 0x00, 0x00, 0x00, 0x02,
      0x00, 0x00, 0x00, 0x08, 0x1e, 0x00, 0x00, 0x00, 0x7f, 0x35, 0x04, 0xf7,
    ])
    expect(Array.from(buildBypass(false, 0))).toEqual([
      0xf0, 0x00, 0x32, 0x09, 0x49, 0x00, 0x00, 0x00, 0x02,
      0x00, 0x00, 0x00, 0x00, 0x1e, 0x00, 0x00, 0x00, 0x7f, 0x37, 0x04, 0xf7,
    ])
  })
})

const statusReply = (b0: number, b1: number, b2: number, b3: number) =>
  parseSysexFrames([0xf0, 0x00, 0x32, 0x0d, 0x61, 0x00, 0x00, 0x00, 0x02,
    0x00, 0x00, 0x00, 0x00, 0x42, 0x00, 0x00, 0x00, b0, b1, b2, b3, 0x40, 0x18, 0xf7])

describe('parsePedalStatus — região 0x42 decodificada (hardware 2026-07-05)', () => {
  it('decodifica banco, slot e modo do payload normal', () => {
    // amostra real: banco 9 (b0=8), slot C (b2=8), NORMAL (b3=08)
    expect(parsePedalStatus(statusReply(0x08, 0x10, 0x08, 0x08)))
      .toEqual({ bankIndex: 8, slotIndex: 2, mode: 'normal', bypass: false })
    // varredura PC 17 → 5B: b0=4, b2=4, live/normal conforme b3
    expect(parsePedalStatus(statusReply(0x04, 0x08, 0x04, 0x00)))
      .toEqual({ bankIndex: 4, slotIndex: 1, mode: 'live', bypass: false })
    expect(parsePedalStatus(statusReply(0x00, 0x00, 0x0c, 0x10)))
      .toEqual({ bankIndex: 0, slotIndex: 3, mode: 'tuner', bypass: false })
  })

  it('bypass (7C 0F) anula slot e modo, banco permanece', () => {
    expect(parsePedalStatus(statusReply(0x06, 0x0c, 0x7c, 0x0f)))
      .toEqual({ bankIndex: 6, slotIndex: null, mode: null, bypass: true })
  })

  it('rejeita payload malformado sem lançar', () => {
    expect(parsePedalStatus(statusReply(0x7f, 0x00, 0x08, 0x08))).toBeNull() // banco > 8
    expect(parsePedalStatus(statusReply(0x00, 0x00, 0x08, 0x33))).toBeNull() // modo desconhecido
    expect(parsePedalStatus([])).toBeNull() // sem resposta
  })

  it('buildStatusRead é o frame replay da 0x42 (ck fixo 57 01)', () => {
    expect(Array.from(buildStatusRead())).toEqual([0xf0, 0x00, 0x32, 0x0d, 0x41,
      0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x42, 0x00, 0x00, 0x00, 0x57, 0x01, 0xf7])
  })
})

// Save na flash (09 69 + 09 41) — vetores validados NO HARDWARE em 2026-06-11:
// frames construídos do zero com ck8 = (230 - addr - Σraw) mod 256 receberam ACK
// e o conteúdo persistiu após recarga via Program Change (ver docs/protocol/usb-sysex.md).
describe('buildPresetSave / buildFlashCommit — save na flash', () => {
  const factorySlot = (k: number): Uint8Array =>
    Uint8Array.from(PEDAL_SLOTS[k as keyof typeof PEDAL_SLOTS])
  const hex = (a: ArrayLike<number>): string =>
    Array.from(a, (b: number) => b.toString(16).padStart(2, '0')).join(' ')

  it('reproduz o frame de save do 1A de fábrica (ACK confirmado no pedal)', () => {
    const preset = decodePreset(factorySlot(0), 1, 'A')
    expect(hex(buildPresetSave(0, preset))).toBe(
      'f0 00 32 09 69 01 00 00 02 02 00 00 00 50 02 00 00 ' +
      '01 00 00 08 00 00 40 31 3f 7e 7c 21 06 00 00 00 7f 18 08 00 70 7f 3f 00 53 01 f7'
    )
  })

  it('reproduz o frame de save do 2C de fábrica (slot 6 — addr 128 em 7-bit LE)', () => {
    const preset = decodePreset(factorySlot(6), 2, 'C')
    expect(hex(buildPresetSave(6, preset))).toBe(
      'f0 00 32 09 69 01 00 00 02 00 01 00 00 50 02 00 00 ' +
      '01 00 00 08 00 40 40 1d 3f 7e 7c 79 07 00 40 01 3c 6c 00 20 00 40 6a 3f 49 00 f7'
    )
  })

  it('reproduz o frame capturado do M-EFCS (1A com gain=21, ck "21 00")', () => {
    const bytes = factorySlot(0)
    bytes[6] = 0x15 // gain alterado pelo usuário na captura
    const preset = decodePreset(bytes, 1, 'A')
    expect(hex(buildPresetSave(0, preset))).toBe(
      'f0 00 32 09 69 01 00 00 02 02 00 00 00 50 02 00 00 ' +
      '01 00 00 08 00 00 40 0a 3f 7e 7c 21 06 00 00 00 7f 18 08 00 70 7f 3f 00 21 00 f7'
    )
  })

  it('checksum de slots altos usa a soma dos BYTES do addr, não o valor numérico', () => {
    // addr ≥ 256: termo do ck = (addr&0xff)+(addr>>8). Coincide com o numérico
    // só abaixo de 256 — por isso as capturas (addr 2 e 128) nunca discriminaram.
    // ck golden confirmado por ACK do hardware em 2026-06-12 (writes no-op):
    //   slot 13 (addr 275) → ck 41 | slot 32 (addr 674) → ck 150 | slot 35 (addr 737) → ck 68
    const cases: Array<[number, number]> = [[13, 41], [32, 150], [35, 68]]
    for (const [slot, ck] of cases) {
      const frame = buildPresetSave(slot, decodePreset(factorySlot(slot), 1, 'A'))
      const ckObs = frame[frame.length - 3] | (frame[frame.length - 2] << 7)
      expect(ckObs, `slot ${slot}`).toBe(ck)
    }
  })

  it('todos os bytes do frame são MIDI-safe (7 bits) exceto F0/F7', () => {
    for (const k of [0, 6, 35]) {
      const frame = buildPresetSave(k, decodePreset(factorySlot(k), 1, 'A'))
      for (let i = 1; i < frame.length - 1; i++) {
        expect(frame[i]).toBeLessThan(0x80)
      }
    }
  })

  it('buildFlashCommit reproduz o frame constante capturado (idêntico p/ qualquer slot)', () => {
    expect(hex(buildFlashCommit())).toBe(
      'f0 00 32 09 41 00 00 00 02 00 00 00 00 0f 00 00 00 0b 00 f7'
    )
  })

  it('rejeita índice de slot fora de 0-35', () => {
    const preset = decodePreset(factorySlot(0), 1, 'A')
    expect(() => buildPresetSave(-1, preset)).toThrow()
    expect(() => buildPresetSave(36, preset)).toThrow()
  })
})

// Regressão da ordem dos enables (bug 2026-06-11): 2A de fábrica = `01 01 00 00`
// e o PEDAL liga AMP+MOD ⇒ byte 0 = AMP. A interpretação antiga (byte 0 = REVERB)
// fazia o app exibir REVERB+MOD no 2A.
describe('ordem dos enables no registro (0=AMP, 1=MOD, 2=DELAY, 3=REVERB)', () => {
  it('decodifica o 2A de fábrica como AMP+MOD ligados (verdade do pedal)', () => {
    const p = decodePreset(Uint8Array.from(PEDAL_SLOTS[4]), 2, 'A')
    expect(p.amp.enabled).toBe(true)
    expect(p.mod.enabled).toBe(true)
    expect(p.delay.enabled).toBe(false)
    expect(p.reverb.enabled).toBe(false)
  })

  it('enables sem remap: addr 0=AMP, 3=REVERB (idêntico ao encodePreset)', () => {
    const p = createDefaultPreset(1, 'A')
    p.reverb.enabled = true
    p.amp.enabled = false
    const live = presetToLiveBytes(p)
    const file = Array.from(encodePreset(p))
    expect(live[0]).toBe(0) // AMP off
    expect(live[3]).toBe(1) // REVERB on
    // idêntico exceto a cor (18-20), que vai em 7-bit no preview
    expect(live.slice(0, 18)).toEqual(file.slice(0, 18))
  })
})

// Resposta real capturada em hardware (2026-07-05): 44 bytes, payload 24B Jieli-packed
const ACTIVE_PRESET_REPLY = [0xf0, 0x00, 0x32, 0x0d, 0x69, 0x01, 0x00, 0x00, 0x02,
  0x00, 0x00, 0x00, 0x00, 0x51, 0x02, 0x00, 0x00,
  0x01, 0x00, 0x00, 0x08, 0x40, 0x09, 0x02, 0x25, 0x50, 0x64, 0x00, 0x3a,
  0x03, 0x00, 0x00, 0x00, 0x00, 0x70, 0x00, 0x08, 0x70, 0x5f, 0x6a, 0x7f,
  0x5c, 0x00, 0xf7]

describe('parseActivePreset — região 51 02 (preset ativo)', () => {
  it('extrai 21 bytes live-order da resposta 0d 69 real', () => {
    const live = parseActivePreset(parseSysexFrames(ACTIVE_PRESET_REPLY))
    expect(live).not.toBeNull()
    expect(live!.length).toBe(21)
    expect(live![0]).toBe(0x01) // enable AMP do preset capturado
  })

  it('payload todo-zero (bypass) retorna null', () => {
    const zeroed = [...ACTIVE_PRESET_REPLY]
    for (let i = 17; i < 41; i++) zeroed[i] = 0
    expect(parseActivePreset(parseSysexFrames(zeroed))).toBeNull()
  })

  it('sem resposta 0d 69 retorna null', () => {
    expect(parseActivePreset([])).toBeNull()
  })

  it('buildActivePresetRead é o frame replay da 51 02 (ck fixo 56 01)', () => {
    expect(Array.from(buildActivePresetRead())).toEqual([0xf0, 0x00, 0x32, 0x0d, 0x41,
      0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x51, 0x02, 0x00, 0x00, 0x56, 0x01, 0xf7])
  })
})

describe('liveBytesToPreset', () => {
  it('preserva todos os campos de um buffer vindo da flash (cor em 8 bits, sem conversão)', () => {
    // 9C de fábrica: cor 255/170/255 — o pedal devolve exatamente isso após o Program Change.
    const original = createDefaultPreset(9, 'C')
    original.amp.gain = 100
    original.color = { r: 255, g: 170, b: 255 }
    const live = Uint8Array.from(encodePreset(original))
    expect(liveBytesToPreset(live, 9, 'C')).toEqual(original)
  })

  it('eco de uma escrita nossa chega em 7 bits e é repassado como está', () => {
    const original = createDefaultPreset(3, 'B')
    original.color = { r: 255, g: 128, b: 7 }
    const live = Uint8Array.from(presetToLiveBytes(original))
    expect(liveBytesToPreset(live, 3, 'B').color).toEqual({ r: 127, g: 64, b: 3 })
  })
})

describe('parseDiscoveryReply', () => {
  // Resposta real do pedal (v96), capturada em 2026-11-02 via amidi.
  const REPLY = 'F0003245580100002A411C2D6A72481D195F6064310300000000000000000000000000000000602DF7'
    .match(/../g)!.map((x) => parseInt(x, 16))

  it('extrai modelo e firmware da resposta 45 58 (TANK-Gv2_096)', () => {
    expect(parseDiscoveryReply(REPLY)).toEqual({ model: 'TANK-Gv2', firmware: 96 })
  })

  it('sem sufixo _NNN devolve firmware null', () => {
    const r = parseDiscoveryReply([0xf0, 0, 0x32, 0x45, 0x58, 1, 0, 0, 0x20, 0, 0, 0xf7])
    expect(r.firmware).toBeNull()
  })
})

describe('leitura do armazenamento real (região 50 02)', () => {
  const h = (x: string) => x.replace(/ /g, '').match(/../g)!.map((b) => parseInt(b, 16))

  it('monta o frame que o pedal respondeu (1A e 9C, golden de hardware 2026-11-02)', () => {
    expect(Array.from(buildStoredPresetRead(0))).toEqual(h('F0 00 32 0D 41 00 00 00 02 02 00 00 00 50 02 00 00 64 01 F7'))
    expect(Array.from(buildStoredPresetRead(34))).toEqual(h('F0 00 32 0D 41 00 00 00 02 4C 05 00 00 50 02 00 00 18 00 F7'))
  })

  it('rejeita índice fora de 0-35', () => {
    expect(() => buildStoredPresetRead(36)).toThrow()
  })

  it('decodifica as respostas reais e mapeia pelo addr, em qualquer ordem', () => {
    const r1A = h('F000320D6901000002020000005002000001000008200640313F7E7C21060000007F583811707F0B002300F7')
    const r9C = h('F000320D69010000024C0500005002000001000008400902255064003A0300000000700008705F6A7F1E01F7')
    const map = parseStoredPresets([r9C, r1A])
    // 1A salvo pelo usuário no M-EFCS (difere da fábrica: gate 50, rev 44/46, IR 2)
    expect(Array.from(map.get(0)!)).toEqual([1, 0, 0, 1, 50, 0, 99, 63, 63, 63, 100, 0, 0, 0, 127, 44, 46, 2, 255, 47, 0])
    // 9C igual à fábrica
    expect(Array.from(map.get(34)!)).toEqual(Array.from(PEDAL_SLOTS[34]))
  })

  it('ignora frames de outras regiões', () => {
    const live5102 = h('F000320D6901000002000000005102000001000008000001273704356203000000007A0008605F3F3F4801F7')
    expect(parseStoredPresets([live5102]).size).toBe(0)
  })
})
