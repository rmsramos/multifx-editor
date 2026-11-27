import { MODULE_COLORS } from '../theme'
import ModuleCard from './ModuleCard'
import NoiseGateControls from './controls/NoiseGateControls'

interface NoiseGateModuleProps {
  value: number
  onChange: (value: number) => void
  className?: string
}

// Noise Gate é um threshold (byte 4, 0-127), sempre ativo — sem toggle no app oficial.
export default function NoiseGateModule({ value, onChange, className }: NoiseGateModuleProps) {
  return (
    <ModuleCard title="Noise Gate" color={MODULE_COLORS.gate} accentOff={value === 0} className={className}>
      <NoiseGateControls value={value} onChange={onChange} />
    </ModuleCard>
  )
}
