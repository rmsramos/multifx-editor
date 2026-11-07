import type { PresetSlot } from '@shared/types/preset'
import { PRESET_SLOTS, BANK_RANGE } from '@shared/constants'
import { BRAND_COLOR } from '../theme'
import { useTranslation } from '../i18n'

interface PresetGridProps {
  currentBank: number
  currentSlot: PresetSlot
  dirtyIndices: Set<number>
  /** Sujos cuja diferença veio do pedal — marcador vazado em vez de cheio. */
  pedalDirtyIndices?: Set<number>
  /** Timestamp da última troca feita no pedal (0 = nenhuma): anima o slot ativo. */
  pedalSwitchAt?: number
  onSelect: (bank: number, slot: PresetSlot) => void
}

export default function PresetGrid({ currentBank, currentSlot, dirtyIndices, pedalDirtyIndices, pedalSwitchAt = 0, onSelect }: PresetGridProps) {
  const banks = Array.from(
    { length: BANK_RANGE.max - BANK_RANGE.min + 1 },
    (_, i) => BANK_RANGE.min + i
  )

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[16px_repeat(4,1fr)] gap-1.5 items-center">
        <span />
        {PRESET_SLOTS.map((slot) => (
          <span key={slot} className="text-center text-[10px] font-semibold text-tank-muted">
            {slot}
          </span>
        ))}
        {banks.map((bank) => (
          <BankRow
            key={bank}
            bank={bank}
            currentBank={currentBank}
            currentSlot={currentSlot}
            dirtyIndices={dirtyIndices}
            pedalDirtyIndices={pedalDirtyIndices}
            pedalSwitchAt={pedalSwitchAt}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

function BankRow({
  bank, currentBank, currentSlot, dirtyIndices, pedalDirtyIndices, pedalSwitchAt = 0, onSelect
}: PresetGridProps & { bank: number }) {
  // Só anima logo após a troca no pedal; um re-render tardio (ex.: troca pela UI) não repete.
  const freshPedalSwitch = pedalSwitchAt > 0 && Date.now() - pedalSwitchAt < 1000
  const { t } = useTranslation()
  return (
    <>
      <span className="text-[10px] font-semibold text-tank-muted text-center">{bank}</span>
      {PRESET_SLOTS.map((slot) => {
        const index = (bank - 1) * 4 + PRESET_SLOTS.indexOf(slot)
        const isActive = bank === currentBank && slot === currentSlot
        const isDirty = dirtyIndices.has(index)
        const fromPedal = isDirty && (pedalDirtyIndices?.has(index) ?? false)
        const tag = isDirty ? ` (${t(fromPedal ? 'preset.pedalTag' : 'preset.modifiedTag')})` : ''
        const label = `Preset ${bank}${slot}${tag}`
        return (
          <button
            key={slot}
            aria-label={label}
            aria-current={isActive || undefined}
            onClick={() => onSelect(bank, slot)}
            className="relative aspect-square rounded text-[11px] font-semibold cursor-pointer transition-colors border"
            style={
              isActive
                ? { backgroundColor: BRAND_COLOR, borderColor: BRAND_COLOR, color: '#0f1014' }
                : { backgroundColor: '#17181d', borderColor: '#262933', color: '#8b8e98' }
            }
          >
            {bank}{slot}
            {isDirty && (
              <span
                data-testid={fromPedal ? 'dirty-pedal' : 'dirty-ui'}
                className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full border"
                style={
                  fromPedal
                    ? { borderColor: isActive ? '#0f1014' : BRAND_COLOR, backgroundColor: 'transparent' }
                    : { borderColor: 'transparent', backgroundColor: isActive ? '#0f1014' : BRAND_COLOR }
                }
              />
            )}
            {isActive && freshPedalSwitch && (
              <span
                key={pedalSwitchAt}
                aria-hidden="true"
                data-testid="pedal-switch-ping"
                className="pointer-events-none absolute inset-0 rounded motion-safe:animate-[pedal-switch-ping_700ms_cubic-bezier(0.23,1,0.32,1)_forwards]"
              />
            )}
          </button>
        )
      })}
    </>
  )
}
