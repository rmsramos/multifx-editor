import type { AmpSettings, AmpType } from '@shared/types/preset'
import { AMP_TYPES } from '@shared/constants'
import { MODULE_COLORS } from '../../theme'
import Knob from '../Knob'
import { useTranslation } from '../../i18n'

const AMP_COLOR = MODULE_COLORS.amp

interface AmpControlsProps {
  settings: AmpSettings
  onChange: (settings: AmpSettings) => void
}

/** Modelo + 5 knobs do AMP. Usado pelo card do Painel e pelo detalhe do Rig. */
export default function AmpControls({ settings, onChange }: AmpControlsProps) {
  const { t } = useTranslation()
  const handleKnobChange = (key: keyof AmpSettings) => (value: number) => {
    onChange({ ...settings, [key]: value })
  }

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...settings, type: e.target.value as AmpType })
  }

  return (
    <div className="flex items-center gap-4 flex-wrap w-full">
      <label className="flex flex-col gap-1.5 min-w-0 w-[15rem]">
        <span className="text-xs text-tank-muted">{t('amp.model')}</span>
        <select
          value={settings.type}
          onChange={handleTypeChange}
          title={settings.type}
          disabled={!settings.enabled}
          className="w-full truncate bg-tank-raised text-tank-text text-xs rounded px-2 py-1.5 border border-tank-border cursor-pointer disabled:cursor-default disabled:text-tank-disabled"
        >
          {AMP_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      {/* 5 knobs sempre numa linha; sem espaço, o bloco inteiro desce para baixo do modelo */}
      <div className="flex-1 min-w-[32rem] flex gap-3 justify-evenly">
        <Knob label="Gain" value={settings.gain} color={AMP_COLOR} onChange={handleKnobChange('gain')} disabled={!settings.enabled} />
        <Knob label="Treble" value={settings.treble} color={AMP_COLOR} onChange={handleKnobChange('treble')} disabled={!settings.enabled} />
        <Knob label="Middle" value={settings.middle} color={AMP_COLOR} onChange={handleKnobChange('middle')} disabled={!settings.enabled} />
        <Knob label="Bass" value={settings.bass} color={AMP_COLOR} onChange={handleKnobChange('bass')} disabled={!settings.enabled} />
        <Knob label="Volume" value={settings.volume} color={AMP_COLOR} onChange={handleKnobChange('volume')} disabled={!settings.enabled} />
      </div>
    </div>
  )
}
