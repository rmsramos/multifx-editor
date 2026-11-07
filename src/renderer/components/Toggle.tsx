interface ToggleProps {
  enabled: boolean
  color: string
  onToggle: () => void
  disabled?: boolean
  label?: string
  title?: string
  /** Ação em andamento (ex.: navegação de ~1-2s do afinador): pulsa até confirmar. */
  pending?: boolean
}

export default function Toggle({ enabled, color, onToggle, disabled = false, label, title, pending = false }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-busy={pending}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onToggle}
      className={`relative rounded-full border-none p-0 ${pending ? 'animate-pulse' : ''} ${disabled ? 'cursor-default opacity-40' : pending ? 'cursor-wait' : 'cursor-pointer'}`}
      style={{
        width: 36,
        height: 18,
        backgroundColor: enabled ? color : '#262933',
        boxShadow: enabled ? `0 0 8px ${color}66` : 'none',
        transition: 'background-color 150ms, box-shadow 150ms'
      }}
    >
      <div
        className="absolute top-[2px] rounded-full transition-all duration-150"
        style={{
          width: 14,
          height: 14,
          left: enabled ? 20 : 2,
          backgroundColor: enabled ? '#ffffff' : '#4a4d57'
        }}
      />
    </button>
  )
}
