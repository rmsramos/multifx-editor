import { Fragment } from 'react'
import type { Preset } from '@shared/types/preset'
import { MODULE_COLORS } from '../theme'
import { useTranslation } from '../i18n'
import type { MessageKey } from '@shared/i18n'

export type ToggleableModule = 'amp' | 'mod' | 'delay' | 'reverb'

interface SignalChainProps {
  preset: Preset
  onToggle: (module: ToggleableModule) => void
}

type Stage =
  | { key: 'gate' | 'cab'; labelKey: MessageKey; color: string; on: boolean }
  | { key: ToggleableModule; labelKey: MessageKey; color: string; on: boolean; toggle: true }

// Ordem real do sinal no pedal: Gate → Amp → Mod → Delay → Reverb → Cab.
// Amp/Mod/Delay/Reverb têm enable (os footswitches do pedal); Gate e Cab estão "ligados"
// quando o threshold > 0 e há um IR selecionado — só indicam, não alternam.
function stages(p: Preset): Stage[] {
  return [
    { key: 'gate', labelKey: 'chain.gate', color: MODULE_COLORS.gate, on: p.noiseGate > 0 },
    { key: 'amp', labelKey: 'chain.amp', color: MODULE_COLORS.amp, on: p.amp.enabled, toggle: true },
    { key: 'mod', labelKey: 'chain.mod', color: MODULE_COLORS.mod, on: p.mod.enabled, toggle: true },
    { key: 'delay', labelKey: 'chain.delay', color: MODULE_COLORS.delay, on: p.delay.enabled, toggle: true },
    { key: 'reverb', labelKey: 'chain.reverb', color: MODULE_COLORS.reverb, on: p.reverb.enabled, toggle: true },
    { key: 'cab', labelKey: 'chain.cab', color: MODULE_COLORS.irCab, on: p.irCab > 0 },
  ]
}

export default function SignalChain({ preset, onToggle }: SignalChainProps) {
  const { t } = useTranslation()
  return (
    <ol aria-label={t('chain.label')} className="flex items-center">
      {stages(preset).map((s, i) => {
        const body = (
          <>
            <span
              className="w-2 h-2 rounded-full border"
              style={s.on ? { backgroundColor: s.color, borderColor: s.color, boxShadow: `0 0 6px ${s.color}88` } : { borderColor: '#6b6f7b' }}
            />
            {t(s.labelKey)}
          </>
        )
        const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium'
        const tone = s.on ? 'border-tank-border bg-tank-raised text-tank-text' : 'border-tank-border text-tank-disabled'
        return (
          <Fragment key={s.key}>
            {i > 0 && <li aria-hidden="true" className="w-4 h-px bg-tank-border" />}
            <li>
              {'toggle' in s ? (
                <button
                  role="switch"
                  aria-checked={s.on}
                  onClick={() => onToggle(s.key)}
                  className={`${base} ${tone} cursor-pointer hover:border-tank-muted`}
                >
                  {body}
                </button>
              ) : (
                <span className={`${base} ${tone}`}>{body}</span>
              )}
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}
