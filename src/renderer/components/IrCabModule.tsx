import { IR_CAB_SLOTS } from '@shared/constants'
import { MODULE_COLORS } from '../theme'
import ModuleCard from './ModuleCard'
import { useTranslation } from '../i18n'

const IR_CAB_COLOR = MODULE_COLORS.irCab

interface IrCabModuleProps {
  value: number
  onChange: (value: number) => void
  className?: string
}

// irCab = byte 17, índice 0-8 (0 = off, 1-8 = slots de IR do manual).
export default function IrCabModule({ value, onChange, className }: IrCabModuleProps) {
  const { t } = useTranslation()
  const currentIr = IR_CAB_SLOTS.find((s) => s.id === value)

  return (
    <ModuleCard
      title="IR Cab"
      color={IR_CAB_COLOR}
      accentOff={value === 0}
      className={className}
    >
      <label className="flex flex-col gap-1.5 w-full max-w-[16rem] min-w-0">
        <span className="text-xs text-tank-muted">{t('ircab.slot')}</span>
        <select
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          title={currentIr ? currentIr.name : undefined}
          className="w-full truncate bg-tank-raised text-tank-text text-sm rounded px-3 py-2 border border-tank-border cursor-pointer"
        >
          {IR_CAB_SLOTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id === 0 ? s.name : `${s.name} (${s.size})`}
            </option>
          ))}
        </select>
      </label>
    </ModuleCard>
  )
}
