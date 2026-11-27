import type { Preset } from '@shared/types/preset'
import { blockAmountRange, decodeBlockParam, DELAY_TYPES, MOD_TYPES, REVERB_TYPES } from '@shared/block-param'
import { IR_CAB_SLOTS } from '@shared/constants'
import { MODULE_COLORS } from './theme'
import { ampCode, cabCode } from './presetMeta'

export type RigBlockKey = 'gate' | 'amp' | 'mod' | 'delay' | 'reverb' | 'cab'
export type ToggleableBlock = 'amp' | 'mod' | 'delay' | 'reverb'

export interface MiniKnobValue {
  value: number
  min: number
  max: number
}

export interface RigBlock {
  key: RigBlockKey
  color: string
  /** Soa no sinal: ligado E (nos knobs-bloco) fora da zona morta; gate > 0; IR ≠ 0. */
  active: boolean
  /** Tem enable próprio (footswitch no pedal): Amp, Mod, Delay, Reverb. */
  toggleable: boolean
  enabled: boolean
  /** Tipo/modelo mostrado no bloco: "SPRING", "OFF" (zona morta), "4RAT_OD", "3MESA_412". */
  typeLabel: string | null
  /** Valores reais para os mini-knobs decorativos, cada um na sua faixa. */
  knobs: MiniKnobValue[]
}

const FULL = { min: 0, max: 127 }
const full = (value: number): MiniKnobValue => ({ value, ...FULL })

function blockParam(byte: number, names: readonly string[]): { label: string; amount: MiniKnobValue } {
  const { type, amount } = decodeBlockParam(byte)
  if (type === null) return { label: 'OFF', amount: { value: 0, min: 0, max: 40 } }
  return { label: names[type].toUpperCase(), amount: { value: amount, ...blockAmountRange(type) } }
}

/** Número de cones do gabinete pelo tamanho do IR ("4x12" → 4); 0 quando Off. */
export function cabCones(irCab: number): number {
  const size = IR_CAB_SLOTS.find((s) => s.id === irCab)?.size ?? ''
  const n = Number.parseInt(size, 10)
  return Number.isFinite(n) ? n : 0
}

/** O que a pedaleira desenha, na ordem fixa do Tank-G: Gate → Amp → Mod → Delay → Reverb → Cab. */
export function rigBlocks(p: Preset): RigBlock[] {
  const mod = blockParam(p.mod.fx, MOD_TYPES)
  const delay = blockParam(p.delay.mix, DELAY_TYPES)
  const reverb = blockParam(p.reverb.decay, REVERB_TYPES)
  return [
    {
      key: 'gate', color: MODULE_COLORS.gate, active: p.noiseGate > 0, toggleable: false, enabled: true,
      typeLabel: null, knobs: [full(p.noiseGate)],
    },
    {
      key: 'amp', color: MODULE_COLORS.amp, active: p.amp.enabled, toggleable: true, enabled: p.amp.enabled,
      typeLabel: ampCode(p.amp.type),
      knobs: [p.amp.gain, p.amp.treble, p.amp.middle, p.amp.bass, p.amp.volume].map(full),
    },
    {
      key: 'mod', color: MODULE_COLORS.mod, active: p.mod.enabled && mod.label !== 'OFF', toggleable: true,
      enabled: p.mod.enabled, typeLabel: mod.label, knobs: [full(p.mod.speed), mod.amount],
    },
    {
      key: 'delay', color: MODULE_COLORS.delay, active: p.delay.enabled && delay.label !== 'OFF', toggleable: true,
      enabled: p.delay.enabled, typeLabel: delay.label, knobs: [full(p.delay.time), delay.amount],
    },
    {
      key: 'reverb', color: MODULE_COLORS.reverb, active: p.reverb.enabled && reverb.label !== 'OFF', toggleable: true,
      enabled: p.reverb.enabled, typeLabel: reverb.label, knobs: [full(p.reverb.mix), reverb.amount],
    },
    {
      key: 'cab', color: MODULE_COLORS.irCab, active: p.irCab > 0, toggleable: false, enabled: true,
      typeLabel: cabCode(p.irCab), knobs: [],
    },
  ]
}
