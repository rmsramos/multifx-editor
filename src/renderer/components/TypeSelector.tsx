import type { BlockType } from '@shared/block-param'

interface TypeSelectorProps {
  options: readonly [string, string, string]
  /** null = zona morta (nenhum tipo ativo) */
  value: BlockType | null
  color: string
  onChange: (type: BlockType) => void
  /** Módulo desligado: mantém o tipo visível, mas sem a cor cheia do ativo. */
  disabled?: boolean
}

/** Seletor segmentado dos 3 processos de um knob-bloco (Room/Spring/Cloud etc.). */
export default function TypeSelector({ options, value, color, onChange, disabled = false }: TypeSelectorProps) {
  return (
    <div className="flex w-full max-w-[16rem] rounded-md border border-tank-border overflow-hidden" role="radiogroup">
      {options.map((label, i) => {
        const active = value === i
        const style = active
          ? disabled
            ? { backgroundColor: `${color}26`, color: '#8b8e98' }
            : { backgroundColor: color, color: '#0f1014' }
          : { backgroundColor: '#1d1f26', color: disabled ? '#6b6f7b' : '#8b8e98' }
        return (
          <button
            key={label}
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(i as BlockType)}
            className={`flex-1 min-w-0 px-1.5 py-1.5 text-xs font-semibold truncate border-none ${
              disabled ? 'cursor-default' : 'cursor-pointer'
            }`}
            style={style}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
