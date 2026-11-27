import { MODULE_COLORS } from '../../theme'
import Knob from '../Knob'

interface NoiseGateControlsProps {
  value: number
  onChange: (value: number) => void
}

// Noise Gate é um threshold (byte 4, 0-127), sempre ativo — sem toggle no app oficial.
export default function NoiseGateControls({ value, onChange }: NoiseGateControlsProps) {
  return <Knob label="Threshold" value={value} color={MODULE_COLORS.gate} onChange={onChange} />
}
