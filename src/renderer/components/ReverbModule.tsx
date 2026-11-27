import type { ReverbSettings } from '@shared/types/preset'
import { decodeBlockParam } from '@shared/block-param'
import { MODULE_COLORS } from '../theme'
import ModuleCard from './ModuleCard'
import ReverbControls from './controls/ReverbControls'

interface ReverbModuleProps {
  settings: ReverbSettings
  onChange: (settings: ReverbSettings) => void
  className?: string
}

// Card do Painel: título, selo "Off" (byte do knob-bloco na zona morta) e enable.
// Os controles vivem em controls/ReverbControls (compartilhados com o modo Rig).
export default function ReverbModule({ settings, onChange, className }: ReverbModuleProps) {
  const offZone = decodeBlockParam(settings.decay).type === null
  return (
    <ModuleCard
      title="Reverb"
      color={MODULE_COLORS.reverb}
      badge={offZone ? 'Off' : undefined}
      enabled={settings.enabled}
      onToggle={() => onChange({ ...settings, enabled: !settings.enabled })}
      className={className}
    >
      <ReverbControls settings={settings} onChange={onChange} />
    </ModuleCard>
  )
}
