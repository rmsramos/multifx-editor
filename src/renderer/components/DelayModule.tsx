import type { DelaySettings } from '@shared/types/preset'
import { decodeBlockParam } from '@shared/block-param'
import { MODULE_COLORS } from '../theme'
import ModuleCard from './ModuleCard'
import DelayControls from './controls/DelayControls'

interface DelayModuleProps {
  settings: DelaySettings
  onChange: (settings: DelaySettings) => void
  className?: string
}

// Card do Painel: título, selo "Off" (byte do knob-bloco na zona morta) e enable.
// Os controles vivem em controls/DelayControls (compartilhados com o modo Rig).
export default function DelayModule({ settings, onChange, className }: DelayModuleProps) {
  const offZone = decodeBlockParam(settings.mix).type === null
  return (
    <ModuleCard
      title="Delay"
      color={MODULE_COLORS.delay}
      badge={offZone ? 'Off' : undefined}
      enabled={settings.enabled}
      onToggle={() => onChange({ ...settings, enabled: !settings.enabled })}
      className={className}
    >
      <DelayControls settings={settings} onChange={onChange} />
    </ModuleCard>
  )
}
