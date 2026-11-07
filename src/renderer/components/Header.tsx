import type { ConnectionStatus } from '@shared/types/device'
import ConnectionBadge from './ConnectionBadge'
import LanguageSelector from './LanguageSelector'
import { BRAND_COLOR } from '../theme'
import { useTranslation } from '../i18n'

interface HeaderProps {
  connectionStatus: ConnectionStatus
}

export default function Header({ connectionStatus }: HeaderProps) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between bg-tank-card border-b border-tank-border px-4 h-11">
      <div className="flex items-center gap-5">
        <span className="font-display text-lg font-bold tracking-wide">
          Multi<span style={{ color: BRAND_COLOR }}>FX</span>
          <span className="ml-2 text-sm font-semibold text-tank-muted">Editor</span>
        </span>
        {/* abas — estrutura pronta para telas futuras (IRs/AMPs) */}
        <nav className="flex items-center gap-1">
          <button
            className="px-3 py-1 text-xs font-medium rounded text-tank-text cursor-default"
            style={{ backgroundColor: '#1d1f26', boxShadow: `inset 0 -2px 0 ${BRAND_COLOR}` }}
          >
            {t('nav.presets')}
          </button>
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <ConnectionBadge status={connectionStatus} />
        <LanguageSelector />
      </div>
    </div>
  )
}
