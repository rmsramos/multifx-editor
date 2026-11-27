import { IR_CAB_SLOTS } from '@shared/constants'
import { useTranslation } from '../../i18n'

interface IrCabControlsProps {
  value: number
  onChange: (value: number) => void
}

// irCab = byte 17, índice 0-8 (0 = off, 1-8 = slots de IR do manual).
export default function IrCabControls({ value, onChange }: IrCabControlsProps) {
  const { t } = useTranslation()
  const currentIr = IR_CAB_SLOTS.find((s) => s.id === value)

  return (
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
  )
}
