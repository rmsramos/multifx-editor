import type { AmpSettings } from '@shared/types/preset'
import { MODULE_COLORS } from '../theme'
import ModuleCard from './ModuleCard'
import AmpControls from './controls/AmpControls'

interface AmpModuleProps {
  settings: AmpSettings
  onChange: (settings: AmpSettings) => void
  className?: string
}

// Card do Painel; os controles vivem em controls/AmpControls (compartilhados com o modo Rig).
export default function AmpModule({ settings, onChange, className }: AmpModuleProps) {
  return (
    <ModuleCard
      title="AMP"
      color={MODULE_COLORS.amp}
      enabled={settings.enabled}
      onToggle={() => onChange({ ...settings, enabled: !settings.enabled })}
      className={className}
    >
      <AmpControls settings={settings} onChange={onChange} />
    </ModuleCard>
  )
}
