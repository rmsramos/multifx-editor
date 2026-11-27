interface FootswitchProps {
  on: boolean
  label: string
  onToggle: () => void
}

/** Footswitch cromado do pedal: liga/desliga o efeito, como pisar no pedal de verdade. */
export default function Footswitch({ on, label, onToggle }: FootswitchProps) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className="absolute bottom-2.5 left-1/2 h-7 w-7 -translate-x-1/2 rounded-full cursor-pointer bg-[radial-gradient(circle_at_40%_35%,var(--color-rig-chrome-hi),var(--color-rig-chrome-mid)_45%,var(--color-rig-jack)_80%)] shadow-[0_2px_4px_rgba(0,0,0,.55),inset_0_-2px_2px_rgba(0,0,0,.35)] active:scale-95"
    />
  )
}
