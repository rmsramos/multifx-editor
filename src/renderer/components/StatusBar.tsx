import type { PresetSlot } from '@shared/types/preset'
import type { DeviceInfo } from '@shared/types/device'
import { useTranslation } from '../i18n'

const APP_LABEL = `MultiFX Editor v${__APP_VERSION__}`

interface StatusBarProps {
  currentBank: number
  currentSlot: PresetSlot
  isDirty: boolean
  isCurrentDirty: boolean
  /** O sujo do preset atual veio do pedal (knob físico / outro app), não da UI. */
  isCurrentPedalDirty?: boolean
  deviceInfo?: DeviceInfo | null
}

export default function StatusBar({
  currentBank, currentSlot, isDirty, isCurrentDirty, isCurrentPedalDirty = false, deviceInfo = null,
}: StatusBarProps) {
  const { t } = useTranslation()
  const slot = `${currentBank}${currentSlot}`
  const device = deviceInfo
    ? [deviceInfo.id, deviceInfo.model ?? deviceInfo.name, deviceInfo.firmware !== undefined ? t('status.firmware', { version: deviceInfo.firmware }) : null]
        .filter(Boolean)
        .join(' · ')
    : null
  return (
    <div className="flex items-center justify-between gap-4 bg-tank-card border-t border-tank-border px-4 py-1.5 text-xs">
      <span className="text-tank-muted tabular-nums truncate">
        {device ? `${APP_LABEL} · ${device}` : APP_LABEL}
      </span>
      {isCurrentDirty ? (
        <span className={isCurrentPedalDirty ? 'text-tank-muted' : 'text-tank-warn'}>
          {t(isCurrentPedalDirty ? 'status.presetDiffersPedal' : 'status.presetModified', { slot })}
        </span>
      ) : isDirty ? (
        <span className="text-tank-warn">{t('status.presetsUnsaved')}</span>
      ) : null}
    </div>
  )
}
