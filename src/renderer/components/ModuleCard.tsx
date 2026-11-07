import type { ReactNode } from 'react'
import Toggle from './Toggle'

interface ModuleCardProps {
  title: string
  color: string
  badge?: string
  enabled?: boolean
  onToggle?: () => void
  /** Apaga só a faixa superior (Gate em 0, IR Cab em Off) sem bloquear o conteúdo. */
  accentOff?: boolean
  className?: string
  children: ReactNode
}

export default function ModuleCard({
  title,
  color,
  badge,
  enabled,
  onToggle,
  accentOff = false,
  className = '',
  children
}: ModuleCardProps) {
  // Sem toggle (Gate, IR Cab) o módulo é tratado como sempre ativo.
  const isOff = enabled === false

  return (
    <div className={`flex flex-col min-w-0 bg-tank-card border border-tank-border rounded-lg overflow-hidden ${className}`}>
      <div
        data-testid="module-stripe"
        className="h-[2px] w-full transition-colors duration-150"
        style={{ backgroundColor: isOff || accentOff ? '#262933' : color }}
      />
      <div className="px-5 py-4 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-4 mb-4">
          <span className="font-display text-base font-semibold uppercase tracking-widest text-tank-text whitespace-nowrap">
            {title}
          </span>
          <div className="flex items-center gap-2 min-w-0">
            {badge && (
              <span
                title={badge}
                className="text-[11px] px-2 py-0.5 rounded-full font-medium truncate max-w-[12rem]"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {badge}
              </span>
            )}
            {onToggle && enabled !== undefined && (
              <Toggle enabled={enabled} color={color} onToggle={onToggle} />
            )}
          </div>
        </div>
        {/* inert: módulo desligado não aceita NENHUMA interação interna (selects,
            seletores de tipo etc.) — só o Toggle do header continua acessível.
            Sem opacidade aqui: cada controle tem seu próprio estado desabilitado legível. */}
        <div className="flex flex-wrap gap-5 justify-center items-center flex-1" inert={isOff}>
          {children}
        </div>
      </div>
    </div>
  )
}
