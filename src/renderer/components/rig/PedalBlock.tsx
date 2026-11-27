import type { RigBlock } from '../../rigModel'
import MiniKnob from './MiniKnob'
import Footswitch from './Footswitch'
import { blockSurface, selectedRing } from './rigStyles'

interface PedalBlockProps {
  block: RigBlock
  name: string
  selectLabel: string
  footswitchLabel: string
  selected: boolean
  onSelect: () => void
  onToggle?: () => void
}

/** Stompbox (Gate, Mod, Delay, Reverb): metal pintado na cor do bloco, knobs, LED e footswitch. */
export default function PedalBlock({ block, name, selectLabel, footswitchLabel, selected, onSelect, onToggle }: PedalBlockProps) {
  const plate = block.typeLabel ?? name.toUpperCase()
  return (
    <div className="relative h-[124px] w-[92px] flex-none">
      <button
        aria-label={selectLabel}
        aria-pressed={selected}
        data-active={block.active}
        onClick={onSelect}
        className={`${blockSurface(block.active)} ${selectedRing(selected)} absolute inset-0 rounded-[10px] cursor-pointer flex flex-col items-center pt-3`}
        style={{
          backgroundColor: block.color,
          backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,0) 38%, rgba(0,0,0,.18))',
        }}
      >
        <Screws />
        <span className="flex gap-1.5">
          {block.knobs.map((k, i) => (
            <MiniKnob key={i} {...k} />
          ))}
        </span>
        <span
          aria-hidden="true"
          className="mt-2 h-1.5 w-1.5 rounded-full"
          style={
            block.active
              ? { backgroundColor: '#ff3b30', boxShadow: '0 0 6px 1px #ff3b30' }
              : { backgroundColor: '#3a1513' }
          }
        />
        <span className="mt-1.5 rounded-[3px] bg-black/70 px-1.5 py-[1px] font-display text-[11px] font-bold tracking-wide text-white">
          {plate}
        </span>
        {block.typeLabel && (
          <span className="mt-0.5 font-display text-[9px] font-semibold tracking-wider text-black/55">{name}</span>
        )}
      </button>
      {onToggle && <Footswitch on={block.enabled} label={footswitchLabel} onToggle={onToggle} />}
    </div>
  )
}

function Screws() {
  const dot = 'absolute h-[5px] w-[5px] rounded-full bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,.35)]'
  return (
    <span aria-hidden="true">
      <span className={`${dot} left-1.5 top-1.5`} />
      <span className={`${dot} right-1.5 top-1.5`} />
      <span className={`${dot} left-1.5 bottom-1.5`} />
      <span className={`${dot} right-1.5 bottom-1.5`} />
    </span>
  )
}
