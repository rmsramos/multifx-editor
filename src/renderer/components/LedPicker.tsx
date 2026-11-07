import { useEffect, useId, useRef, useState } from 'react'
import type { PresetColor } from '@shared/types/preset'
import { useTranslation } from '../i18n'

interface LedPickerProps {
  color: PresetColor
  onChange: (color: PresetColor) => void
  disabled?: boolean
}

export const toHex = ({ r, g, b }: PresetColor): string =>
  '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')

const fromHex = (hex: string): PresetColor => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
})

// O pedal guarda a cor ao vivo em 7 bits (value>>1): #ffffff volta como #fcfcfc/#fefefe.
// Compara com tolerância para o swatch continuar marcado depois da ida e volta.
const sameColor = (a: string, b: string): boolean =>
  [1, 3, 5].every((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 4)

const SWATCHES = [
  { labelKey: 'color.red', hex: '#ff0000' },
  { labelKey: 'color.orange', hex: '#ff7f00' },
  { labelKey: 'color.yellow', hex: '#ffd400' },
  { labelKey: 'color.green', hex: '#00ff00' },
  { labelKey: 'color.cyan', hex: '#00ffff' },
  { labelKey: 'color.blue', hex: '#0040ff' },
  { labelKey: 'color.purple', hex: '#8000ff' },
  { labelKey: 'color.magenta', hex: '#ff00ff' },
  { labelKey: 'color.white', hex: '#ffffff' },
] as const

// Cor do LED do preset (bytes 18-20). Fica junto do nome do preset na toolbar: é um
// atributo do preset, não um bloco da cadeia de sinal. O input nativo cobre 0-255; o
// preview ao vivo no pedal usa 7 bits (codec faz value>>1), o save mantém 8 bits.
export default function LedPicker({ color, onChange, disabled = false }: LedPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const hex = toHex(color)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        aria-label={t('led.buttonLabel', { hex: hex.toUpperCase() })}
        aria-expanded={open}
        aria-controls={panelId}
        title={t('led.title')}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`block w-5 h-5 rounded-full border-2 border-tank-border ${disabled ? 'opacity-40 cursor-default' : 'cursor-pointer'}`}
        style={{ backgroundColor: hex, boxShadow: `0 0 10px ${hex}66` }}
      />
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t('led.title')}
          className="absolute left-0 top-full mt-2 z-40 w-max origin-top-left rounded-lg border border-tank-border bg-tank-raised p-3 shadow-xl transition-[opacity,scale] duration-150 ease-out starting:opacity-0 starting:scale-[0.97]"
        >
          <div className="flex items-center justify-between gap-6 mb-3">
            <span className="text-xs font-semibold text-tank-text">{t('led.title')}</span>
            <span className="text-xs tabular-nums text-tank-muted">{hex.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-2">
            {SWATCHES.map((s) => {
              const isActive = sameColor(s.hex, hex)
              return (
                <button
                  key={s.hex}
                  aria-label={`LED ${t(s.labelKey)}`}
                  aria-pressed={isActive}
                  title={t(s.labelKey)}
                  onClick={() => onChange(fromHex(s.hex))}
                  className="w-6 h-6 rounded-full border-2 cursor-pointer"
                  style={{ backgroundColor: s.hex, borderColor: isActive ? '#ffffff' : '#262933' }}
                />
              )
            })}
          </div>
          <label className="mt-3 flex items-center gap-2 cursor-pointer text-xs text-tank-muted hover:text-tank-text" title={t('led.customTitle')}>
            <span
              className="w-6 h-6 rounded-full border-2 border-dashed border-tank-muted"
              style={{ backgroundColor: hex }}
            />
            {t('led.customize')}
            <input
              type="color"
              value={hex}
              onChange={(e) => onChange(fromHex(e.target.value))}
              className="sr-only"
              aria-label={t('led.pickerLabel')}
            />
          </label>
        </div>
      )}
    </div>
  )
}
