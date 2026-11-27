import type { MiniKnobValue } from '../../rigModel'

interface MiniKnobProps extends MiniKnobValue {
  size?: number
}

/** Knob decorativo do desenho: o ponteiro gira de -135° a +135° conforme o valor real. */
export default function MiniKnob({ value, min, max, size = 16 }: MiniKnobProps) {
  const pct = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0
  const angle = -135 + pct * 270
  return (
    <span
      aria-hidden="true"
      className="relative block rounded-full bg-[radial-gradient(circle_at_35%_30%,var(--color-rig-knob),var(--color-rig-hole)_70%)] shadow-[0_2px_3px_rgba(0,0,0,.6),inset_0_0_0_1px_rgba(255,255,255,.08)]"
      style={{ width: size, height: size }}
    >
      <span
        className="absolute left-1/2 top-[12%] h-[38%] w-[2px] rounded-full bg-white/85"
        style={{ transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: '50% 100%' }}
      />
    </span>
  )
}
