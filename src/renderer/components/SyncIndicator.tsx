import type { ConnectionStatus, SyncState } from '@shared/types/device'
import { useTranslation } from '../i18n'

interface SyncIndicatorProps {
  connectionStatus: ConnectionStatus
  syncState: SyncState
  onRetry: () => void
}

export default function SyncIndicator({ connectionStatus, syncState, onRetry }: SyncIndicatorProps) {
  const { t } = useTranslation()
  if (connectionStatus !== 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-tank-muted">
        <span className="w-2 h-2 rounded-full border border-tank-muted" />
        {t('sync.offline')}
      </span>
    )
  }
  if (syncState === 'error') {
    return (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 text-xs text-tank-err cursor-pointer bg-transparent border-none p-0"
      >
        <span className="w-2 h-2 rounded-full bg-tank-err" />
        {t('sync.error')}
      </button>
    )
  }
  if (syncState === 'applying') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-tank-warn">
        <span className="w-2 h-2 rounded-full bg-tank-warn animate-pulse" />
        {t('sync.applying')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-tank-ok">
      <span className="w-2 h-2 rounded-full bg-tank-ok" />
      {t('sync.synced')}
    </span>
  )
}
