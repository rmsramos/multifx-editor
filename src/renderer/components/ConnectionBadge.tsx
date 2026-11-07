import type { ConnectionStatus } from '@shared/types/device'
import { useTranslation } from '../i18n'

interface ConnectionBadgeProps {
  status: ConnectionStatus
}

// Derivadas dos tokens do tema (globals.css): texto na cor do estado, fundo a ~15 %.
const STATUS_COLORS: Record<ConnectionStatus, { bg: string; text: string }> = {
  connected: { bg: '#4ade8026', text: '#4ade80' },
  disconnected: { bg: '#8b8e9826', text: '#8b8e98' },
  scanning: { bg: '#60a5fa26', text: '#93c5fd' },
  connecting: { bg: '#fbbf2426', text: '#fbbf24' },
  error: { bg: '#f8717126', text: '#f87171' },
}

export default function ConnectionBadge({ status }: ConnectionBadgeProps) {
  const { t } = useTranslation()
  const config = STATUS_COLORS[status]
  const isAnimating = status === 'scanning' || status === 'connecting'

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      <span
        className={`w-2 h-2 rounded-full ${isAnimating ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: config.text }}
      />
      {t(`connection.${status}`)}
    </span>
  )
}
