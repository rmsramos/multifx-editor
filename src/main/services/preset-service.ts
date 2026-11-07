import type { Preset } from '../../shared/types/preset'
import { BANK_RANGE, PRESET_SLOTS, PARAM_RANGE } from '../../shared/constants'
import { decodeAllPresets } from '../protocol/preset-codec'
import type { Transport } from '../transport/transport'

export class PresetService {
  constructor(private transport: Transport) {}


  validate(preset: Preset): boolean {
    if (preset.bank < BANK_RANGE.min || preset.bank > BANK_RANGE.max) return false
    if (!PRESET_SLOTS.includes(preset.slot as any)) return false
    const numericFields = [
      preset.noiseGate,
      preset.amp.gain,
      preset.amp.treble,
      preset.amp.middle,
      preset.amp.bass,
      preset.amp.volume,
      preset.mod.speed,
      preset.mod.fx,
      preset.delay.time,
      preset.delay.mix,
      preset.reverb.mix,
      preset.reverb.decay,
    ]
    if (!numericFields.every((v) => v >= PARAM_RANGE.min && v <= PARAM_RANGE.max)) return false
    if (preset.irCab < 0 || preset.irCab > 8) return false
    const colorFields = [preset.color.r, preset.color.g, preset.color.b]
    if (!colorFields.every((v) => v >= 0 && v <= 255)) return false
    return true
  }

  exportToJson(preset: Preset): string {
    return JSON.stringify(preset, null, 2)
  }

  importFromJson(json: string): Preset {
    const parsed = JSON.parse(json) as Preset
    if (!this.validate(parsed)) throw new Error('Preset inválido')
    return parsed
  }

  async readAll(): Promise<Preset[]> {
    const raw = await this.transport.readAllPresets()
    return decodeAllPresets(raw)
  }

}
