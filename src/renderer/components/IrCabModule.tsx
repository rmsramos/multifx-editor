import { MODULE_COLORS } from '../theme'
import ModuleCard from './ModuleCard'
import IrCabControls from './controls/IrCabControls'

interface IrCabModuleProps {
  value: number
  onChange: (value: number) => void
  className?: string
}

// irCab = byte 17, índice 0-8 (0 = off, 1-8 = slots de IR do manual).
export default function IrCabModule({ value, onChange, className }: IrCabModuleProps) {
  return (
    <ModuleCard title="IR Cab" color={MODULE_COLORS.irCab} accentOff={value === 0} className={className}>
      <IrCabControls value={value} onChange={onChange} />
    </ModuleCard>
  )
}
