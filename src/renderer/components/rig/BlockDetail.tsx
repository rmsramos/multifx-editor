import type { AmpSettings, DelaySettings, ModSettings, Preset, ReverbSettings } from '@shared/types/preset'
import { MODULE_COLORS } from '../../theme'
import type { RigBlockKey } from '../../rigModel'
import { useTranslation } from '../../i18n'
import { BLOCK_NAME_KEYS } from './RigBoard'
import AmpControls from '../controls/AmpControls'
import ModControls from '../controls/ModControls'
import DelayControls from '../controls/DelayControls'
import ReverbControls from '../controls/ReverbControls'
import NoiseGateControls from '../controls/NoiseGateControls'
import IrCabControls from '../controls/IrCabControls'

export interface BlockUpdaters {
  onUpdatePreset: (changes: Partial<Preset>) => void
  onUpdateAmp: (settings: AmpSettings) => void
  onUpdateMod: (settings: ModSettings) => void
  onUpdateDelay: (settings: DelaySettings) => void
  onUpdateReverb: (settings: ReverbSettings) => void
}

interface BlockDetailProps extends BlockUpdaters {
  block: RigBlockKey
  preset: Preset
}

const COLORS: Record<RigBlockKey, string> = {
  gate: MODULE_COLORS.gate,
  amp: MODULE_COLORS.amp,
  mod: MODULE_COLORS.mod,
  delay: MODULE_COLORS.delay,
  reverb: MODULE_COLORS.reverb,
  cab: MODULE_COLORS.irCab,
}

/** Controles do bloco selecionado na pedaleira (os mesmos componentes dos cards do Painel). */
export default function BlockDetail({ block, preset, onUpdatePreset, onUpdateAmp, onUpdateMod, onUpdateDelay, onUpdateReverb }: BlockDetailProps) {
  const { t } = useTranslation()
  const title = block === 'gate' ? t('rig.gateTitle') : block === 'cab' ? t('rig.cabTitle') : t(BLOCK_NAME_KEYS[block])
  const color = COLORS[block]

  const toggleable =
    block === 'amp' ? { on: preset.amp.enabled, flip: () => onUpdateAmp({ ...preset.amp, enabled: !preset.amp.enabled }) }
    : block === 'mod' ? { on: preset.mod.enabled, flip: () => onUpdateMod({ ...preset.mod, enabled: !preset.mod.enabled }) }
    : block === 'delay' ? { on: preset.delay.enabled, flip: () => onUpdateDelay({ ...preset.delay, enabled: !preset.delay.enabled }) }
    : block === 'reverb' ? { on: preset.reverb.enabled, flip: () => onUpdateReverb({ ...preset.reverb, enabled: !preset.reverb.enabled }) }
    : null

  return (
    <section
      aria-label={title}
      className="rounded-xl border border-tank-border bg-tank-card px-6 py-5"
      style={{ boxShadow: `inset 0 2px 0 ${color}` }}
    >
      <div className="mb-5 flex items-center gap-3">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <h2 className="font-display text-lg font-semibold tracking-wide text-tank-text">{title}</h2>
        {toggleable && (
          <button
            role="switch"
            aria-checked={toggleable.on}
            onClick={toggleable.flip}
            className="ml-auto inline-flex items-center gap-2 rounded-md border border-tank-border bg-tank-raised px-3 py-1.5 text-xs font-semibold text-tank-text cursor-pointer hover:border-tank-muted"
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={toggleable.on ? { backgroundColor: color, boxShadow: `0 0 6px ${color}` } : { backgroundColor: 'var(--color-rig-off)' }}
            />
            {t(toggleable.on ? 'rig.on' : 'rig.off')}
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-6">
        {block === 'gate' && <NoiseGateControls value={preset.noiseGate} onChange={(noiseGate) => onUpdatePreset({ noiseGate })} />}
        {block === 'amp' && <AmpControls settings={preset.amp} onChange={onUpdateAmp} />}
        {block === 'mod' && <div className="w-[22rem]"><ModControls settings={preset.mod} onChange={onUpdateMod} /></div>}
        {block === 'delay' && <div className="w-[22rem]"><DelayControls settings={preset.delay} onChange={onUpdateDelay} /></div>}
        {block === 'reverb' && <div className="w-[22rem]"><ReverbControls settings={preset.reverb} onChange={onUpdateReverb} /></div>}
        {block === 'cab' && (
          <>
            <IrCabControls value={preset.irCab} onChange={(irCab) => onUpdatePreset({ irCab })} />
            <p className="max-w-[18rem] text-xs text-tank-muted">{t('rig.cabNoKnobs')}</p>
          </>
        )}
      </div>
    </section>
  )
}
