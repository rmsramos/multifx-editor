import { MODULE_COLORS } from '../theme'
import ModuleCard from './ModuleCard'
import Knob from './Knob'

const NOISE_GATE_COLOR = MODULE_COLORS.gate

interface NoiseGateModuleProps {
  value: number
  onChange: (value: number) => void
  className?: string
}

// Noise Gate é um threshold (byte 4, 0-127), sempre ativo — sem toggle no app oficial.
export default function NoiseGateModule({ value, onChange, className }: NoiseGateModuleProps) {
  return (
    <ModuleCard title="Noise Gate" color={NOISE_GATE_COLOR} accentOff={value === 0} className={className}>
      <Knob label="Threshold" value={value} color={NOISE_GATE_COLOR} onChange={onChange} />
    </ModuleCard>
  )
}
