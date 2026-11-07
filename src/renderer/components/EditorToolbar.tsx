import type { ConnectionStatus, SyncState } from '@shared/types/device'
import type { PresetColor } from '@shared/types/preset'
import LedPicker from './LedPicker'
import Toggle from './Toggle'
import SyncIndicator from './SyncIndicator'
import { useTranslation } from '../i18n'

interface EditorToolbarProps {
  /** Rótulo do preset em edição (ex.: "1A") — título da tela. */
  presetLabel: string
  ledColor: PresetColor
  onLedColorChange: (color: PresetColor) => void
  bypass: boolean
  onBypassToggle: () => void
  connectionStatus: ConnectionStatus
  syncState: SyncState
  onRetry: () => void
  onSave: () => void
  onDiscard: () => void
  isCurrentDirty: boolean
  tunerActive: boolean
  tunerPending: boolean
  onTunerToggle: () => void
}

export default function EditorToolbar({
  presetLabel, ledColor, onLedColorChange,
  bypass, onBypassToggle, connectionStatus, syncState, onRetry, onSave, onDiscard, isCurrentDirty,
  tunerActive, tunerPending, onTunerToggle,
}: EditorToolbarProps) {
  const { t } = useTranslation()
  const canSave = connectionStatus === 'connected'
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2 border-b border-tank-border">
      <div className="flex items-center gap-2">
        <h1
          className="font-display text-xl font-bold tabular-nums leading-none text-tank-text"
          aria-label={t('editor.presetTitle', { slot: presetLabel })}
        >
          {presetLabel}
        </h1>
        <LedPicker color={ledColor} onChange={onLedColorChange} disabled={bypass || tunerActive} />
        <span aria-hidden="true" className="mx-2 h-5 w-px bg-tank-border" />
        <span className="text-xs text-tank-muted">{t('toolbar.bypass')}</span>
        <Toggle enabled={bypass} color="#fbbf24" onToggle={onBypassToggle} disabled={connectionStatus !== 'connected'} label={t('toolbar.bypass')} />
        <span className="ml-3 text-xs text-tank-muted">{t('toolbar.tuner')}</span>
        <Toggle
          enabled={tunerActive}
          color="#4ade80"
          onToggle={onTunerToggle}
          disabled={connectionStatus !== 'connected'}
          pending={tunerPending}
          label={t('toolbar.tuner')}
          title={t('toolbar.tunerTitle')}
        />
      </div>
      <div className="flex items-center gap-3">
        <span aria-live="polite">
          <SyncIndicator connectionStatus={connectionStatus} syncState={syncState} onRetry={onRetry} />
        </span>
        {isCurrentDirty && (
          <button
            onClick={onDiscard}
            disabled={!canSave}
            title={t('toolbar.discardTitle')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
              canSave
                ? 'bg-tank-raised border-tank-border text-tank-muted hover:text-tank-text hover:border-tank-muted cursor-pointer'
                : 'bg-tank-raised border-tank-border text-tank-muted cursor-default opacity-50'
            }`}
          >
            {t('toolbar.discard')}
          </button>
        )}
        <button
          onClick={onSave}
          disabled={!canSave}
          title={t('toolbar.saveTitle')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
            canSave
              ? isCurrentDirty
                ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 hover:bg-amber-500/25 cursor-pointer'
                : 'bg-tank-raised border-tank-border text-tank-text hover:border-tank-muted cursor-pointer'
              : 'bg-tank-raised border-tank-border text-tank-muted cursor-default opacity-50'
          }`}
        >
          {t('toolbar.save')}
        </button>
      </div>
    </div>
  )
}
