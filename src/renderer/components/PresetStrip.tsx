import { useEffect, useRef, useState } from 'react'
import type { Preset, PresetSlot } from '@shared/types/preset'
import { BANK_RANGE, PRESET_SLOTS } from '@shared/constants'
import { ampCode, dirtyKind, outsideBankDirty, presetIndex } from '../presetMeta'
import { toHex } from './LedPicker'
import DirtyDot from './DirtyDot'
import PresetMapPopover from './PresetMapPopover'
import { useTranslation } from '../i18n'

interface PresetStripProps {
  presets: Preset[]
  currentBank: number
  currentSlot: PresetSlot
  dirtyIndices: Set<number>
  pedalDirtyIndices: Set<number>
  /** Timestamp da última troca feita no pedal (0 = nenhuma): anima o chip ativo. */
  pedalSwitchAt: number
  onSelect: (bank: number, slot: PresetSlot) => void
  onImport: () => void
  onExport: () => void
}

const BANK_COUNT = BANK_RANGE.max - BANK_RANGE.min + 1
const wrapBank = (bank: number): number =>
  ((((bank - BANK_RANGE.min) % BANK_COUNT) + BANK_COUNT) % BANK_COUNT) + BANK_RANGE.min

const stripBtn =
  'px-2.5 py-1.5 text-xs rounded-md bg-tank-raised border border-tank-border text-tank-muted hover:text-tank-text hover:border-tank-muted cursor-pointer'

/**
 * Navegação de presets no topo: banco exibido + os 4 presets dele. As setas só NAVEGAM
 * (nenhum Program Change); o pedal troca ao clicar num chip ou no mapa. O banco exibido
 * volta ao do preset ativo sempre que ele muda (pela UI ou pelo próprio pedal).
 */
export default function PresetStrip({
  presets, currentBank, currentSlot, dirtyIndices, pedalDirtyIndices, pedalSwitchAt, onSelect, onImport, onExport,
}: PresetStripProps) {
  const { t } = useTranslation()
  const [viewedBank, setViewedBank] = useState(currentBank)
  const [mapOpen, setMapOpen] = useState(false)
  const allBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setViewedBank(currentBank)
  }, [currentBank, currentSlot, pedalSwitchAt])

  // Só anima logo após a troca no pedal; um re-render tardio não repete.
  const freshPedalSwitch = pedalSwitchAt > 0 && Date.now() - pedalSwitchAt < 1000
  const others = outsideBankDirty(viewedBank, dirtyIndices, pedalDirtyIndices)

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-tank-border bg-tank-card">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-tank-muted mr-1">
          {t('strip.bank')}
        </span>
        <button
          aria-label={t('strip.prevBank')}
          onClick={() => setViewedBank((b) => wrapBank(b - 1))}
          className={`${stripBtn} px-2`}
        >
          ‹
        </button>
        <span
          aria-live="polite"
          className="w-7 text-center font-display text-base font-bold tabular-nums text-tank-text"
        >
          {viewedBank}
        </span>
        <button
          aria-label={t('strip.nextBank')}
          onClick={() => setViewedBank((b) => wrapBank(b + 1))}
          className={`${stripBtn} px-2`}
        >
          ›
        </button>
      </div>

      <div className="flex items-center gap-2">
        {PRESET_SLOTS.map((slot) => {
          const index = presetIndex(viewedBank, slot)
          const preset = presets[index]
          const isActive = viewedBank === currentBank && slot === currentSlot
          const kind = dirtyKind(index, dirtyIndices, pedalDirtyIndices)
          const tag = kind ? ` (${t(kind === 'pedal' ? 'preset.pedalTag' : 'preset.modifiedTag')})` : ''
          const led = toHex(preset.color)
          return (
            <button
              key={slot}
              aria-label={`Preset ${viewedBank}${slot}${tag}`}
              aria-current={isActive || undefined}
              onClick={() => onSelect(viewedBank, slot)}
              className={`relative flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                isActive
                  ? 'border-tank-warn bg-tank-warn/10 text-tank-text'
                  : 'border-tank-border bg-tank-raised text-tank-muted hover:text-tank-text hover:border-tank-muted'
              }`}
            >
              <span className="font-display text-sm font-bold tabular-nums text-tank-text">
                {viewedBank}{slot}
              </span>
              <span
                aria-hidden="true"
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: led, boxShadow: `0 0 6px ${led}88` }}
              />
              <span className="max-w-[6.5rem] truncate">{ampCode(preset.amp.type)}</span>
              {kind && <DirtyDot kind={kind} />}
              {isActive && freshPedalSwitch && (
                <span
                  key={pedalSwitchAt}
                  aria-hidden="true"
                  data-testid="pedal-switch-ping"
                  className="pointer-events-none absolute inset-0 rounded-md motion-safe:animate-[pedal-switch-ping_700ms_cubic-bezier(0.23,1,0.32,1)_forwards]"
                />
              )}
            </button>
          )
        })}
      </div>

      {viewedBank !== currentBank && (
        <span className="text-xs text-tank-muted">{t('strip.activeIn', { slot: `${currentBank}${currentSlot}` })}</span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <button
            ref={allBtnRef}
            aria-expanded={mapOpen}
            aria-haspopup="dialog"
            title={others ? t('strip.otherBanksModified') : undefined}
            onClick={() => setMapOpen((o) => !o)}
            className={`${stripBtn} relative`}
          >
            {t('strip.allPresets')} ▾
            {others && <DirtyDot kind={others} />}
          </button>
          {mapOpen && (
            <PresetMapPopover
              presets={presets}
              currentBank={currentBank}
              currentSlot={currentSlot}
              dirtyIndices={dirtyIndices}
              pedalDirtyIndices={pedalDirtyIndices}
              anchorRef={allBtnRef}
              onSelect={onSelect}
              onClose={() => setMapOpen(false)}
            />
          )}
        </div>
        <button onClick={onImport} title={t('header.importTitle')} className={stripBtn}>
          {t('header.import')}
        </button>
        <button onClick={onExport} title={t('header.exportTitle')} className={stripBtn}>
          {t('header.export')}
        </button>
      </div>
    </div>
  )
}
