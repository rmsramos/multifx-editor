import { useSettingsStore, type ViewMode } from '../stores/settings-store'
import { useTranslation } from '../i18n'
import type { MessageKey } from '@shared/i18n'

const MODES: { mode: ViewMode; labelKey: MessageKey }[] = [
  { mode: 'panel', labelKey: 'view.panel' },
  { mode: 'rig', labelKey: 'view.rig' },
]

/** Alterna a área do editor entre Painel (cards) e Rig (pedaleira). Mesmo visual do LanguageSelector. */
export default function ViewModeSelector() {
  const { t } = useTranslation()
  const viewMode = useSettingsStore((s) => s.viewMode)
  const setViewMode = useSettingsStore((s) => s.setViewMode)

  return (
    <div
      role="group"
      aria-label={t('view.label')}
      className="flex items-center gap-0.5 rounded bg-tank-raised border border-tank-border p-0.5"
    >
      {MODES.map(({ mode, labelKey }) => {
        const active = mode === viewMode
        return (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            aria-pressed={active}
            className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
              active ? 'bg-tank-card text-tank-text' : 'text-tank-muted hover:text-tank-text'
            }`}
          >
            {t(labelKey)}
          </button>
        )
      })}
    </div>
  )
}
