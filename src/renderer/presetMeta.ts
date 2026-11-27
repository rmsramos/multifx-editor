import type { AmpType, PresetSlot } from '@shared/types/preset'
import { IR_CAB_SLOTS, PRESET_SLOTS } from '@shared/constants'

export type DirtyKind = 'ui' | 'pedal'

/** Índice 0-35 do preset (banco 1-9 × slot A-D), o mesmo dos sets de "sujo" do store. */
export function presetIndex(bank: number, slot: PresetSlot): number {
  return (bank - 1) * 4 + PRESET_SLOTS.indexOf(slot)
}

const SEP = ' · '

/** "4RAT_OD · Pro Co RAT" → "4RAT_OD" (código do manual). */
export function ampCode(type: AmpType | string): string {
  return type.split(SEP)[0]
}

/** "4RAT_OD · Pro Co RAT" → "Pro Co RAT" (equipamento que inspira o modelo). */
export function ampName(type: AmpType | string): string {
  return type.split(SEP)[1] ?? type
}

/** Código curto do IR do slot (0 = "Off"). */
export function cabCode(id: number): string {
  const slot = IR_CAB_SLOTS.find((s) => s.id === id)
  if (!slot || id === 0) return 'Off'
  return slot.name.split(SEP)[0]
}

/** Tipo de "sujo" do preset: editado na UI, diferença vinda do pedal, ou limpo. */
export function dirtyKind(index: number, dirty: Set<number>, pedalDirty: Set<number>): DirtyKind | null {
  if (!dirty.has(index)) return null
  return pedalDirty.has(index) ? 'pedal' : 'ui'
}

/** Resumo dos sujos FORA do banco exibido: 'ui' vence 'pedal'; null se nenhum. */
export function outsideBankDirty(bank: number, dirty: Set<number>, pedalDirty: Set<number>): DirtyKind | null {
  const first = (bank - 1) * 4
  let kind: DirtyKind | null = null
  for (const idx of dirty) {
    if (idx >= first && idx < first + 4) continue
    if (!pedalDirty.has(idx)) return 'ui'
    kind = 'pedal'
  }
  return kind
}
