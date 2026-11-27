import type { ModSettings } from '@shared/types/preset'
import { decodeBlockParam } from '@shared/block-param'
import { MODULE_COLORS } from '../theme'
import ModuleCard from './ModuleCard'
import ModControls from './controls/ModControls'

interface ModModuleProps {
  settings: ModSettings
  onChange: (settings: ModSettings) => void
  className?: string
}

// Card do Painel: título, selo "Off" (byte do knob-bloco na zona morta) e enable.
// Os controles vivem em controls/ModControls (compartilhados com o modo Rig).
export default function ModModule({ settings, onChange, className }: ModModuleProps) {
  const offZone = decodeBlockParam(settings.fx).type === null
  return (
    <ModuleCard
      title="MOD"
      color={MODULE_COLORS.mod}
      badge={offZone ? 'Off' : undefined}
      enabled={settings.enabled}
      onToggle={() => onChange({ ...settings, enabled: !settings.enabled })}
      className={className}
    >
      <ModControls settings={settings} onChange={onChange} />
    </ModuleCard>
  )
}
