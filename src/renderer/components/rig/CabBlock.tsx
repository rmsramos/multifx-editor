import type { RigBlock } from '../../rigModel'
import { blockSurface, selectedRing } from './rigStyles'

interface CabBlockProps {
  block: RigBlock
  /** Quantidade de cones do IR (1, 2 ou 4); 0 = Off. */
  cones: number
  selectLabel: string
  selected: boolean
  onSelect: () => void
}

/** Caixa de alto-falantes: os cones seguem o tamanho do IR (1x12, 2x10, 4x12…). */
export default function CabBlock({ block, cones, selectLabel, selected, onSelect }: CabBlockProps) {
  const grid = cones >= 4 ? 'grid-cols-2 grid-rows-2' : cones === 2 ? 'grid-cols-2' : 'grid-cols-1'
  const coneSize = cones >= 4 ? 34 : cones === 2 ? 40 : 58
  return (
    <div className="relative h-[124px] w-[116px] flex-none">
      <button
        aria-label={selectLabel}
        aria-pressed={selected}
        data-active={block.active}
        onClick={onSelect}
        className={`${blockSurface(block.active)} ${selectedRing(selected)} absolute inset-0 flex flex-col rounded-[6px] cursor-pointer border-2 bg-[#1b1714] p-[5px]`}
        style={{ borderColor: block.color }}
      >
        <span className="grid flex-1 place-items-center rounded-[3px] bg-[#25211e] p-1.5" aria-hidden="true">
          <span className={`grid ${grid} place-items-center gap-1.5`}>
            {Array.from({ length: cones }, (_, i) => (
              <span
                key={i}
                className="rounded-full shadow-[0_1px_2px_rgba(0,0,0,.6)]"
                style={{
                  width: coneSize,
                  height: coneSize,
                  background: 'radial-gradient(circle, #5b5650 0 16%, #1c1917 19% 58%, #34302c 62% 70%, #1c1917 73%)',
                }}
              />
            ))}
          </span>
        </span>
        <span
          className="mx-auto mt-1 rounded-[3px] px-1.5 py-[1px] font-display text-[10px] font-bold tracking-wide text-[#1a0e00]"
          style={{ backgroundColor: block.color }}
        >
          {block.typeLabel}
        </span>
      </button>
    </div>
  )
}
