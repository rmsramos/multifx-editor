// Protocolo USB-MIDI SysEx do M-VAVE Tank G — derivado de captura real do app
// oficial M-EFCS (usbmon, 2026-06-10). Ver docs/protocol/usb-sysex.md.
//
// Frame de escrita de parâmetro (tipo 0x11):
//   F0 00 32  09 49 00 00 00 02  <addr LE32>  11 00 00 00  <valor>  <ck1> <ck2>  F7
//   resposta do device: F0 00 32 01 08 00 00 00 00 7F 01 F7  (ACK)

import { SYSEX_MANUFACTURER_ID } from '../../shared/constants'
import { encodePreset, decodePreset } from './preset-codec'
import { packJieli, unpackJieli } from './jieli-pack'
import type { Preset, PresetSlot } from '../../shared/types/preset'
import type { PedalStatus, SystemMode } from '../../shared/types/device'

// Constante empírica da família de escrita 0x11, validada contra 61/61 amostras reais.
// ck14 = (BASE - 2*Σbody) ; depois fatiado em dois bytes de 7 bits (little-endian 7-bit).
const WRITE_CHECKSUM_BASE = 670
const MASK7 = 0x7f

/**
 * Checksum de 2 bytes (cada um 7-bit) para um comando de escrita.
 * `body` são os bytes entre o manufacturer id e o checksum — i.e. começando em 09 49.
 */
export function mvaveWriteChecksum(body: number[]): [number, number] {
  const sum = body.reduce((acc, b) => acc + b, 0)
  const ck = ((WRITE_CHECKSUM_BASE - 2 * sum) % 0x4000 + 0x4000) % 0x4000 // 14-bit, sempre positivo
  return [ck & MASK7, (ck >> 7) & MASK7]
}

/** Monta o frame SysEx completo para escrever um byte de parâmetro em `addr`. */
export function buildParamWrite(addr: number, value: number): Uint8Array {
  const body = [0x09, 0x49, 0x00, 0x00, 0x00, 0x02, addr & 0xff, 0x00, 0x00, 0x00, 0x11, 0x00, 0x00, 0x00, value & 0x7f]
  const [c1, c2] = mvaveWriteChecksum(body)
  return Uint8Array.from([0xf0, ...SYSEX_MANUFACTURER_ID, ...body, c1, c2, 0xf7])
}

/** Comando de discovery/handshake (constante; sem checksum). Resposta esperada: cmd 0x45 0x58. */
export function buildDiscovery(): Uint8Array {
  return Uint8Array.from([0xf0, ...SYSEX_MANUFACTURER_ID, 0x45, 0x00, 0x00, 0x00, 0x40, 0x7f, 0xf7])
}


/**
 * Decodifica a resposta `45 58` do discovery em modelo + firmware.
 * Payload (a partir do byte 9) é Jieli-packed e contém a string `"<MODELO>_<VER>"`;
 * o byte 8 carrega o 1º caractere deslocado (`0x2A` = `'T' >> 1`). Confirmado contra o
 * pedal em 2026-11-02: `TANK-Gv2_096` — igual ao que o M-EFCS 3.10 loga (name/version 96).
 */
export function parseDiscoveryReply(frame: ArrayLike<number>): { model: string; firmware: number | null } {
  const f = Array.from(frame)
  const end = f[f.length - 1] === 0xf7 ? f.length - 3 : f.length // corta [ck?, ck?, F7]
  const rest = Array.from(unpackJieli(f.slice(9, end)))
  const zero = rest.indexOf(0)
  const text = String.fromCharCode((f[8] << 1) & 0xff, ...(zero >= 0 ? rest.slice(0, zero) : rest))
  const m = /^(.*)_(\d+)$/.exec(text)
  return m ? { model: m[1], firmware: Number(m[2]) } : { model: text, firmware: null }
}

/**
 * Leitura do blob dos 36 presets (região 0x5e60). Frame replay exato do M-EFCS
 * (checksum fixo capturado — a fórmula de ck das leituras não foi decifrada).
 * Resposta: 0d 71 com 864 bytes de payload Jieli-packed = A5 5A + 36×21 bytes.
 */
/**
 * Leitura de UM preset do armazenamento real do pedal (região `50 02`, onde o save 09 69
 * grava). addr = 2 + 21·índice, 7-bit LE; ck = (230 − (addr&0xFF) − (addr>>8)) mod 256.
 * Resposta `0d 69` com 24 bytes Jieli-packed → 21 bytes crus a partir do addr.
 *
 * NÃO usar a região `60 5e`: ela é a ROM de FÁBRICA. Lê-la fazia o app abrir com os presets
 * de fábrica no lugar dos salvos pelo usuário (confirmado no pedal em 2026-11-02: 1A salvo
 * com gate 50/IR 2, `60 5e` devolvendo gate 0/IR 0).
 */
export function buildStoredPresetRead(index: number): Uint8Array {
  if (index < 0 || index > 35) throw new Error(`Índice de preset inválido: ${index}`)
  const addr = 2 + 21 * index
  const ck = (((SAVE_CHECKSUM_BASE - (addr & 0xff) - ((addr >> 8) & 0xff)) % 256) + 256) % 256
  return Uint8Array.from([
    0xf0, ...SYSEX_MANUFACTURER_ID, 0x0d, 0x41, 0x00, 0x00, 0x00, 0x02,
    addr & MASK7, (addr >> 7) & MASK7, 0x00, 0x00,
    0x50, 0x02, 0x00, 0x00,
    ck & MASK7, (ck >> 7) & 0x01, 0xf7,
  ])
}

/**
 * Extrai os presets das respostas `0d 69` da região `50 02`. Cada resposta traz o próprio
 * addr, então a ordem de chegada não importa. Devolve índice → 21 bytes crus.
 */
export function parseStoredPresets(frames: number[][]): Map<number, Uint8Array> {
  const out = new Map<number, Uint8Array>()
  for (const f of frames) {
    if (f[3] !== 0x0d || f[4] !== 0x69 || f[13] !== 0x50 || f[14] !== 0x02) continue
    const addr = f[9] | (f[10] << 7)
    if ((addr - 2) % 21 !== 0) continue
    const index = (addr - 2) / 21
    if (index < 0 || index > 35) continue
    const raw = unpackJieli(f.slice(17, f.length - 3))
    if (raw.length < 21) continue
    out.set(index, raw.slice(0, 21))
  }
  return out
}

// Família de save (09 69): checksum de 8 BITS (não 14!) sobre os bytes CRUS do
// preset + os BYTES do endereço do registro. O termo do addr é a soma dos bytes
// de 8 bits ((addr&0xFF) + (addr>>8)), NÃO o valor numérico — coincidem só com
// addr < 256, por isso as 12 amostras de captura (addr 2 e 128) nunca
// discriminaram. Decifrado em 2026-06-12 via sweep de ck na leitura 0d 41 da
// região 50 02 (addr 275 → ck 210 = um a menos que o numérico) e confirmado por
// ACK do hardware em writes no-op nos slots 13/32/35:
//   ck8 = (230 - (addr&0xFF) - (addr>>8) - Σ(21 bytes crus)) mod 256
//   ck1 = ck8 & 0x7F ; ck2 = ck8 >> 7
const SAVE_CHECKSUM_BASE = 230

/**
 * Frame 09 69: grava o preset inteiro (21 bytes, ordem ARQUIVO, Jieli-packed) no
 * storage do slot (região 0x250). addr = 2 + 21*índice (offset do registro, 7-bit LE).
 * Persiste só após o commit 09 41 (buildFlashCommit).
 */
export function buildPresetSave(slotIndex: number, preset: Preset): Uint8Array {
  if (slotIndex < 0 || slotIndex > 35) throw new Error(`Índice de preset inválido: ${slotIndex}`)
  const file = encodePreset(preset)
  const addr = 2 + 21 * slotIndex
  const sumRaw = file.reduce((acc, b) => acc + b, 0)
  const addrTerm = (addr & 0xff) + ((addr >> 8) & 0xff)
  const ck = (((SAVE_CHECKSUM_BASE - addrTerm - sumRaw) % 256) + 256) % 256
  return Uint8Array.from([
    0xf0, ...SYSEX_MANUFACTURER_ID, 0x09, 0x69, 0x01, 0x00, 0x00, 0x02,
    addr & MASK7, (addr >> 7) & MASK7, 0x00, 0x00,
    0x50, 0x02, 0x00, 0x00,
    ...packJieli(file),
    ck & MASK7, (ck >> 7) & 0x01, 0xf7,
  ])
}

/**
 * Commit na flash (09 41): sela o que o 09 69 colocou no storage. Frame constante
 * (replay da captura — idêntico para qualquer slot; `0b 00` é o checksum).
 */
export function buildFlashCommit(): Uint8Array {
  return Uint8Array.from([
    0xf0, ...SYSEX_MANUFACTURER_ID, 0x09, 0x41, 0x00, 0x00, 0x00, 0x02,
    0x00, 0x00, 0x00, 0x00, 0x0f, 0x00, 0x00, 0x00, 0x0b, 0x00, 0xf7,
  ])
}

/** Resposta de sucesso do device a uma escrita: F0 00 32 01 08 ... F7. */
export function isAck(frame: ArrayLike<number>): boolean {
  return frame[0] === 0xf0 && frame[1] === 0x00 && frame[2] === 0x32 && frame[3] === 0x01 && frame[4] === 0x08
}

/** Extrai todos os frames SysEx (F0..F7) de um stream de bytes (ex.: saída do amidi). */
export function parseSysexFrames(stream: ArrayLike<number>): number[][] {
  const frames: number[][] = []
  let current: number[] | null = null
  for (let i = 0; i < stream.length; i++) {
    const b = stream[i]
    if (b === 0xf0) current = [b]
    else if (current) {
      current.push(b)
      if (b === 0xf7) {
        frames.push(current)
        current = null
      }
    }
  }
  return frames
}

// Endereços escritos via 09 49 tipo 0x11 (confirmado na captura). Para 4-17 o
// endereço == offset de byte do arquivo de preset: 4 = noiseGate; 5 = ampType;
// 6-10 = gain/treble/middle/bass/volume; 11 = modFx; 12 = modSpeed; 13 = delayMix;
// 14 = delayTime; 15 = reverbDecay; 16 = reverbMix; 17 = irCab; 18-20 = cor RGB
// (também aplicada ao vivo — ver COLOR_ADDRESSES para a conversão 8→7 bits).
export const PRESET_PARAM_ADDRESSES: number[] = [
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09,
  0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11,
  0x12, 0x13, 0x14, // cor RGB (LED do preset) — aplica ao vivo, ACK confirmado no hardware
]

// Bytes de cor (18-20) são 0-255 no preset, mas a escrita ao vivo 09 49 é 7-bit.
// Enviamos value>>1 para preservar a tonalidade no preview (o save Jieli mantém 8-bit).
const COLOR_ADDRESSES = new Set([0x12, 0x13, 0x14])

// Enables (addrs 0-3): o espaço de endereços ao vivo é IGUAL ao layout do registro
// (0=AMP, 1=MOD, 2=DELAY, 3=REVERB) — confirmado no hardware toggle a toggle
// (2026-06-11) e pelo 2A de fábrica (`01 01 00 00` liga AMP+MOD no pedal).
// A "ordem de arquivo" diferente que existia aqui era um erro de interpretação
// do codec, corrigido em 2026-06-11.

/**
 * Bytes do preset no espaço de endereços da escrita ao vivo (live[addr] = valor
 * a escrever no addr). Hoje é o próprio encodePreset — mantido como ponto único
 * de conversão para writes 09 49.
 */
export function presetToLiveBytes(preset: Preset): number[] {
  const file = encodePreset(preset)
  return Array.from(file, (b, addr) => (COLOR_ADDRESSES.has(addr) ? b >> 1 : b))
}


// ── Modos de sistema (afinador / live / normal) ─────────────────────────────
// Região 0x42 devolve o status completo do pedal (banco/slot/modo/bypass — ver
// payload em parsePedalStatus), não só o modo. O modo em si é controlado por
// dois CCs numa linha: NORMAL(0x08) ←CC26→ LIVE(0x00) ←CC27→ AFINADOR(0x10).
// Decifrado em hardware 2026-06-12 (ver docs/protocol/usb-sysex.md).
export const SYSTEM_MODE_CC = { normalLive: 26, liveTuner: 27 } as const

const SYSTEM_MODE_BY_BYTE: Record<number, SystemMode> = { 0x08: 'normal', 0x00: 'live', 0x10: 'tuner' }
const SYSTEM_MODE_ORDER: SystemMode[] = ['normal', 'live', 'tuner']

/** Frame de leitura do status do pedal (região 0x42). Checksum fixo capturado. */
export function buildStatusRead(): Uint8Array {
  return Uint8Array.from([
    0xf0, ...SYSEX_MANUFACTURER_ID, 0x0d, 0x41, 0x00, 0x00, 0x00, 0x02,
    0x00, 0x00, 0x00, 0x00, 0x42, 0x00, 0x00, 0x00, 0x57, 0x01, 0xf7,
  ])
}

// Payload da 0x42 = [banco(0-8), banco*2, slot*4, modo]; bypass sobrepõe b2/b3 com 7C 0F.
const BYPASS_B2 = 0x7c
const BYPASS_B3 = 0x0f

/** Decodifica o status do pedal da resposta 0d 61 da região 0x42, ou null se ausente/malformado. */
export function parsePedalStatus(frames: number[][]): PedalStatus | null {
  const reply = frames.find((f) => f[3] === 0x0d && f[4] === 0x61 && f[13] === 0x42)
  if (!reply || reply.length < 22) return null
  const [b0, , b2, b3] = [reply[17], reply[18], reply[19], reply[20]]
  if (b0 > 8) return null
  if (b2 === BYPASS_B2 && b3 === BYPASS_B3) return { bankIndex: b0, slotIndex: null, mode: null, bypass: true }
  const mode = SYSTEM_MODE_BY_BYTE[b3]
  if (mode === undefined || b2 > 0x0c || b2 % 4 !== 0) return null
  return { bankIndex: b0, slotIndex: b2 >> 2, mode, bypass: false }
}

/** Frame replay de leitura do preset ativo (região 51 02). Checksum fixo capturado. */
export function buildActivePresetRead(): Uint8Array {
  return Uint8Array.from([
    0xf0, ...SYSEX_MANUFACTURER_ID, 0x0d, 0x41, 0x00, 0x00, 0x00, 0x02,
    0x00, 0x00, 0x00, 0x00, 0x51, 0x02, 0x00, 0x00, 0x56, 0x01, 0xf7,
  ])
}

/**
 * Extrai o preset ativo (21 bytes, ordem live = ordem arquivo) da resposta 0d 69.
 * Payload todo-zero = pedal em bypass (buffer mudo) → null.
 */
export function parseActivePreset(frames: number[][]): Uint8Array | null {
  const reply = frames.find((f) => f[3] === 0x0d && f[4] === 0x69 && f[13] === 0x51 && f[14] === 0x02)
  if (!reply) return null
  const packed = reply.slice(17, reply.length - 3) // corta header 17B e cauda ck1 ck2 F7
  if (packed.length !== 24) return null
  const live = unpackJieli(packed)
  if (live.every((b) => b === 0)) return null
  return live
}

/**
 * Reconstrói o Preset a partir dos bytes live, SEM converter a cor. O buffer ao vivo guarda
 * a cor em 8 bits quando o preset vem da flash (Program Change / troca no pé) e em 7 bits
 * logo depois de uma escrita 09 49 nossa (value>>1). Medido no pedal em 2026-11-02: após PC,
 * 9C devolve 255/170/255 (igual à flash). O antigo `<<1` corrompia toda cor de 8 bits
 * (170→84) e sujava o slot a cada troca. Quem compara (store) aceita as duas formas.
 */
export function liveBytesToPreset(live: Uint8Array, bank: number, slot: PresetSlot): Preset {
  return decodePreset(live, bank, slot)
}

/** Par de mensagens MIDI (hex p/ amidi) de um clique de footswitch: press 7F + release 00. */
export function buildCcClick(cc: number): { press: string; release: string } {
  const n = (cc & 0x7f).toString(16).padStart(2, '0').toUpperCase()
  return { press: `B0 ${n} 7F`, release: `B0 ${n} 00` }
}

/** CC a clicar para andar 1 passo de `current` em direção a `target`, ou null se já no alvo. */
export function nextClickToward(current: SystemMode, target: SystemMode): number | null {
  const ci = SYSTEM_MODE_ORDER.indexOf(current)
  const ti = SYSTEM_MODE_ORDER.indexOf(target)
  if (ci === ti) return null
  const step = ti > ci ? 1 : -1
  const edgeIdx = Math.min(ci, ci + step) // índice da aresta: 0 = normal-live, 1 = live-tuner
  return edgeIdx === 0 ? SYSTEM_MODE_CC.normalLive : SYSTEM_MODE_CC.liveTuner
}

// ── Bypass (relativo ao preset atual) ───────────────────────────────────────
// O bypass é "selecionar o preset <índice> com flag de bypass" (família 09 49 tipo
// 0x1e). addr = [índice, 00, 00, flag], flag = 08 (on) / 00 (off); dado = 7f.
// CRÍTICO: é relativo ao preset ATUAL — o índice fixo da captura (32 = 9A) fazia o
// pedal pular para 9A em qualquer outro preset. Decifrado e validado no hardware
// (2026-06-12): ck14 = (on ? 565 : 567) − 2·índice, fatiado em dois bytes 7-bit.
// Bate com a captura (índice 32: ON ck=501/75 03, OFF ck=503/77 03) e com ACKs ao
// vivo no índice 0. Ver docs/protocol/usb-sysex.md, seção "Bypass".
const BYPASS_CHECKSUM_BASE_ON = 565
const BYPASS_CHECKSUM_BASE_OFF = 567

/** Frame SysEx para ligar/desligar o bypass do preset `index` (0-35). Resposta: ACK 01 08. */
export function buildBypass(on: boolean, index: number): Uint8Array {
  const i = index & 0x7f
  const body = [0x09, 0x49, 0x00, 0x00, 0x00, 0x02, i, 0x00, 0x00, on ? 0x08 : 0x00, 0x1e, 0x00, 0x00, 0x00, 0x7f]
  const ck = ((on ? BYPASS_CHECKSUM_BASE_ON : BYPASS_CHECKSUM_BASE_OFF) - 2 * i) & 0x3fff
  return Uint8Array.from([0xf0, ...SYSEX_MANUFACTURER_ID, ...body, ck & 0x7f, (ck >> 7) & 0x7f, 0xf7])
}
