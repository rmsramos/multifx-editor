import { Fragment, useEffect, useRef } from 'react'
import type { Preset, PresetSlot } from '@shared/types/preset'
import { BANK_RANGE, PRESET_SLOTS } from '@shared/constants'
import { ampCode, dirtyKind, presetIndex } from '../presetMeta'
import { toHex } from './LedPicker'
import DirtyDot from './DirtyDot'
import { useTranslation } from '../i18n'

interface PresetMapPopoverProps {
  presets: Preset[]
  currentBank: number
  currentSlot: PresetSlot
  dirtyIndices: Set<number>
  pedalDirtyIndices: Set<number>
  /** Botão que abre o mapa: clicar nele não conta como "clique fora". */
  anchorRef: React.RefObject<HTMLElement | null>
  onSelect: (bank: number, slot: PresetSlot) => void
  onClose: () => void
}

const BANKS = Array.from({ length: BANK_RANGE.max - BANK_RANGE.min + 1 }, (_, i) => BANK_RANGE.min + i)

/** Mapa dos 36 presets (9 bancos × A-D), aberto sob demanda pela faixa de presets. */
export default function PresetMapPopover({
  presets, currentBank, currentSlot, dirtyIndices, pedalDirtyIndices, anchorRef, onSelect, onClose,
}: PresetMapPopoverProps) {
  const { t } = useTranslation()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [anchorRef, onClose])

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label={t('strip.allPresets')}
      className="absolute right-0 top-full mt-2 z-30 w-[34rem] rounded-lg border border-tank-border bg-tank-raised p-3 shadow-2xl shadow-black/60 origin-top-right transition-[opacity,scale] duration-150 ease-out-strong starting:opacity-0 starting:scale-95 motion-reduce:transition-none"
    >
      <div className="grid grid-cols-[16px_repeat(4,1fr)] gap-1.5 items-center">
        <span />
        {PRESET_SLOTS.map((slot) => (
          <span key={slot} className="text-center text-[10px] font-semibold text-tank-muted">{slot}</span>
        ))}
        {BANKS.map((bank) => (
          <Fragment key={bank}>{bankRow(bank)}</Fragment>
        ))}
      </div>
    </div>
  )

  function bankRow(bank: number) {
    return (
      <>
        <span className="text-[10px] font-semibold text-tank-muted text-center">{bank}</span>
        {PRESET_SLOTS.map((slot) => {
          const index = presetIndex(bank, slot)
          const preset = presets[index]
          const isActive = bank === currentBank && slot === currentSlot
          const kind = dirtyKind(index, dirtyIndices, pedalDirtyIndices)
          const tag = kind ? ` (${t(kind === 'pedal' ? 'preset.pedalTag' : 'preset.modifiedTag')})` : ''
          return (
            <button
              key={slot}
              aria-label={`Preset ${bank}${slot}${tag}`}
              aria-current={isActive || undefined}
              onClick={() => {
                onSelect(bank, slot)
                onClose()
              }}
              className={`relative flex items-center gap-1.5 min-w-0 rounded border px-2 py-1.5 text-[11px] cursor-pointer transition-colors ${
                isActive
                  ? 'border-tank-warn bg-tank-warn/10 text-tank-text'
                  : 'border-tank-border bg-tank-card text-tank-muted hover:text-tank-text hover:border-tank-muted'
              }`}
            >
              <span
                aria-hidden="true"
                className="w-2 h-2 flex-none rounded-full"
                style={{ backgroundColor: toHex(preset.color) }}
              />
              <span className="font-semibold tabular-nums text-tank-text">{bank}{slot}</span>
              <span className="truncate">{ampCode(preset.amp.type)}</span>
              {kind && <DirtyDot kind={kind} />}
            </button>
          )
        })}
      </>
    )
  }
}
