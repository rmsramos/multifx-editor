// Knobs-bloco do Tank G (RVB DECAY, DLY MIX, MOD FX): um único byte 0-127 codifica
// o TIPO do efeito (3 processos) + a quantidade dentro do tipo. Entre dois tipos há
// uma zona morta em que o efeito desliga (manual oficial; luzes do módulo apagam).
//
// Partição (validada contra preset de fábrica 2C ↔ display do M-EFCS):
//   0-39   tipo 0 — display 1-40
//   40-42  zona morta
//   43-83  tipo 1 — display 0-40
//   84-86  zona morta
//   87-127 tipo 2 — display 0-40

export type BlockType = 0 | 1 | 2

export interface BlockValue {
  /** null = byte numa zona morta (efeito desligado) */
  type: BlockType | null
  amount: number
}

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))

export function decodeBlockParam(byte: number): BlockValue {
  if (byte <= 39) return { type: 0, amount: byte + 1 }
  if (byte <= 42) return { type: null, amount: 0 }
  if (byte <= 83) return { type: 1, amount: byte - 43 }
  if (byte <= 86) return { type: null, amount: 0 }
  return { type: 2, amount: clamp(byte, 87, 127) - 87 }
}

export function encodeBlockParam(type: BlockType, amount: number): number {
  if (type === 0) return clamp(amount, 1, 40) - 1
  if (type === 1) return 43 + clamp(amount, 0, 40)
  return 87 + clamp(amount, 0, 40)
}

export function blockAmountRange(type: BlockType): { min: number; max: number } {
  return { min: type === 0 ? 1 : 0, max: 40 }
}

// Nomes dos 3 processos por knob (manual oficial M-VAVE Tank G)
export const REVERB_TYPES = ['Room', 'Spring', 'Cloud'] as const
export const DELAY_TYPES = ['Analog', 'Tape', 'Dual'] as const
export const MOD_TYPES = ['Chorus', 'Phaser', 'Tremolo'] as const
/** Parâmetro que o knob MOD FX ajusta em cada tipo (manual: Mix/Depth/Mix). */
export const MOD_FX_PARAM = ['Mix', 'Depth', 'Mix'] as const
