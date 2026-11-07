import { useCallback, useEffect, useRef } from 'react'
import { KNOB_DEFAULT } from '../theme'

interface KnobProps {
  label: string
  value: number
  color: string
  onChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
  defaultValue?: number
}

const SIZE = 92
const STROKE = 7
const RADIUS = (SIZE - STROKE) / 2 - 2
const CENTER = SIZE / 2
const START_ANGLE = -135
const SWEEP = 270

// Desabilitado: o arco some no trilho, mas o número continua legível (o usuário quer ver
// o valor guardado de um módulo desligado). Uma única camada de esmaecimento — o card
// não aplica opacidade por cima.
const DISABLED_ARC = '#4a4d57'
const DISABLED_VALUE = '#8b8e98'
const DISABLED_LABEL = '#6b6f7b'

function polar(angleDeg: number, radius = RADIUS) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) }
}

function arcPath(startAngle: number, endAngle: number): string {
  const start = polar(startAngle)
  const end = polar(endAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`
}

export default function Knob({
  label,
  value,
  color,
  onChange,
  min = 0,
  max = 127,
  disabled = false,
  defaultValue = KNOB_DEFAULT
}: KnobProps) {
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null)
  const dialRef = useRef<HTMLDivElement>(null)

  // O onWheel do React é registrado como passive — preventDefault() lá não impede o
  // scroll do container. Um listener nativo non-passive bloqueia só o scroll da página;
  // a mudança de valor continua no handler React.
  useEffect(() => {
    const el = dialRef.current
    if (!el) return
    const blockScroll = (e: WheelEvent) => e.preventDefault()
    el.addEventListener('wheel', blockScroll, { passive: false })
    return () => el.removeEventListener('wheel', blockScroll)
  }, [])

  const pct = (value - min) / (max - min)
  const valueAngle = START_ANGLE + pct * SWEEP
  const tip = polar(valueAngle)
  const activeColor = disabled ? DISABLED_ARC : color

  const clamp = useCallback(
    (v: number) => Math.round(Math.min(max, Math.max(min, v))),
    [min, max]
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (disabled) return
      const step = e.shiftKey ? 1 : 3
      const delta = e.deltaY < 0 ? step : -step
      onChange(clamp(value + delta))
    },
    [disabled, value, clamp, onChange]
  )

  const handleDoubleClick = useCallback(() => {
    if (disabled) return
    onChange(clamp(defaultValue))
  }, [disabled, defaultValue, clamp, onChange])

  // Pointer capture: o arrasto continua fora do dial e os eventos morrem com o elemento —
  // sem listeners em window que vazariam se o knob desmontar no meio do arrasto
  // (ex.: o pedal troca de preset enquanto o usuário arrasta).
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      dragRef.current = { startY: e.clientY, startValue: value }
    },
    [disabled, value]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return
      const delta = dragRef.current.startY - e.clientY
      const sensitivity = ((max - min) / 100) * (e.shiftKey ? 0.25 : 1)
      onChange(clamp(dragRef.current.startValue + delta * sensitivity))
    },
    [min, max, clamp, onChange]
  )

  const endDrag = useCallback(() => {
    dragRef.current = null
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return
      const page = Math.max(1, Math.round((max - min) / 10))
      const next: Record<string, number> = {
        ArrowUp: value + 1,
        ArrowRight: value + 1,
        ArrowDown: value - 1,
        ArrowLeft: value - 1,
        PageUp: value + page,
        PageDown: value - page,
        Home: min,
        End: max,
      }
      if (!(e.key in next)) return
      e.preventDefault()
      const v = clamp(next[e.key])
      if (v !== value) onChange(v)
    },
    [disabled, value, min, max, clamp, onChange]
  )

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <div
        ref={dialRef}
        data-testid="knob-dial"
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        className={`rounded-full touch-none ${disabled ? 'cursor-default' : 'cursor-ns-resize'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          {/* trilho */}
          <path
            d={arcPath(START_ANGLE, START_ANGLE + SWEEP)}
            fill="none" stroke="#262933" strokeWidth={STROKE} strokeLinecap="round"
          />
          {/* arco de valor */}
          {pct > 0 && (
            <path
              d={arcPath(START_ANGLE, valueAngle)}
              fill="none" stroke={activeColor} strokeWidth={STROKE} strokeLinecap="round"
            />
          )}
          {/* ponto indicador na ponta */}
          <circle cx={tip.x} cy={tip.y} r={4} fill={disabled ? DISABLED_ARC : '#ffffff'} />
          <text
            x={CENTER} y={CENTER + 1}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="18" fontWeight="600"
            style={{ fontVariantNumeric: 'tabular-nums' }}
            fill={disabled ? DISABLED_VALUE : '#e8e9ed'}
          >
            {value}
          </text>
        </svg>
      </div>
      <span
        className="text-xs font-medium"
        style={{ color: disabled ? DISABLED_LABEL : '#8b8e98' }}
      >
        {label}
      </span>
    </div>
  )
}
