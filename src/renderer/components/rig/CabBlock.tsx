import type { RigBlock } from '../../rigModel'
import { blockSurface, selectedRing } from './rigStyles'

interface CabBlockProps {
  block: RigBlock
  /** Quantidade de cones do IR (1, 2 ou 4); 0 = Off (desenha 2 genéricos). */
  cones: number
  selectLabel: string
  selected: boolean
  onSelect: () => void
}

/** Caixa de alto-falantes: os cones seguem o tamanho do IR (1x12, 2x10, 4x12…). */
export default function CabBlock({ block, cones: irCones, selectLabel, selected, onSelect }: CabBlockProps) {
  // IR desligado: a caixa continua com cara de gabinete (2 cones genéricos), só que apagada.
  const cones = irCones > 0 ? irCones : 2
  const grid = cones >= 4 ? 'grid-cols-2 grid-rows-2' : cones === 2 ? 'grid-cols-2' : 'grid-cols-1'
  const coneSize = cones >= 4 ? 34 : cones === 2 ? 40 : 58
  return (
    <div className="relative h-[124px] w-[116px] flex-none">
      <button
        aria-label={selectLabel}
        aria-pressed={selected}
        data-active={block.active}
        onClick={onSelect}
        className={`${blockSurface(block.active)} ${selectedRing(selected)} absolute inset-0 flex flex-col rounded-[6px] cursor-pointer border-2 border-rig-cab-edge bg-rig-chassis p-[5px]`}
      >
        <span
          aria-hidden="true"
          className="grid flex-1 place-items-center rounded-[3px] p-1.5"
          style={{
            backgroundColor: 'var(--color-rig-cab-grille)',
            backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px)',
          }}
        >
          <span className={`grid ${grid} place-items-center gap-1.5`}>
            {Array.from({ length: cones }, (_, i) => (
              <span
                key={i}
                data-testid="cab-cone"
                className="rounded-full shadow-[0_1px_2px_rgba(0,0,0,.6)]"
                style={{
                  width: coneSize,
                  height: coneSize,
                  background: 'radial-gradient(circle, var(--color-rig-cone-hub) 0 16%, var(--color-rig-cone) 19% 58%, var(--color-rig-cone-ring) 62% 70%, var(--color-rig-cone) 73%)',
                }}
              />
            ))}
          </span>
        </span>
        <span
          className="mx-auto mt-1 rounded-[3px] px-1.5 py-[1px] font-display text-[10px] font-bold tracking-wide text-rig-tag-ink"
          style={{ backgroundColor: block.color }}
        >
          {block.typeLabel}
        </span>
      </button>
    </div>
  )
}
