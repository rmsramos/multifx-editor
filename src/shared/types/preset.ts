import { AMP_TYPES } from '../constants'

export type AmpType = (typeof AMP_TYPES)[number]
export type PresetSlot = 'A' | 'B' | 'C' | 'D'

// Layout do preset confirmado contra o app oficial (Tank-Gv2). O byte de "type" só
// existe para o AMP (byte 5); MOD/DELAY/REVERB não têm seletor de tipo no preset.
export interface AmpSettings {
  enabled: boolean
  type: AmpType
  gain: number
  treble: number
  middle: number
  bass: number
  volume: number
}

export interface ModSettings {
  enabled: boolean
  speed: number
  fx: number
}

export interface DelaySettings {
  enabled: boolean
  time: number
  /** Exibido como 0-40 no app; armazenado 0-127. */
  mix: number
}

export interface ReverbSettings {
  enabled: boolean
  mix: number
  /** Exibido como 0-40 no app; armazenado 0-127. */
  decay: number
}

export interface PresetColor {
  r: number
  g: number
  b: number
}

export interface Preset {
  bank: number
  slot: PresetSlot
  /** byte 4: threshold do noise gate (0-127), sempre ativo. */
  noiseGate: number
  reverb: ReverbSettings
  delay: DelaySettings
  mod: ModSettings
  amp: AmpSettings
  /** byte 17: índice do IR cabinet (0 = off, 1-8 = cabs). */
  irCab: number
  /** bytes 18-20: cor RGB do preset. */
  color: PresetColor
}
