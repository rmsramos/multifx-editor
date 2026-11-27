import type { RigBlock } from '../../rigModel'
import MiniKnob from './MiniKnob'
import { blockSurface, focusRing, selectedRing } from './rigStyles'

interface AmpHeadProps {
  block: RigBlock
  /** Equipamento que inspira o modelo (ex. "Pro Co RAT"). */
  modelName: string
  selectLabel: string
  switchLabel: string
  selected: boolean
  onSelect: () => void
  onToggle: () => void
}

/** Cabeçote: gabinete preto, painel na cor do amp com os 5 knobs e a grade com o modelo. */
export default function AmpHead({ block, modelName, selectLabel, switchLabel, selected, onSelect, onToggle }: AmpHeadProps) {
  return (
    <div className={`relative h-[124px] w-[184px] flex-none rounded-[8px] ${selectedRing(selected)}`}>
      <button
        aria-label={selectLabel}
        aria-pressed={selected}
        data-active={block.active}
        onClick={onSelect}
        className={`${blockSurface(block.active)} ${focusRing(selected)} absolute inset-0 flex flex-col overflow-hidden rounded-[8px] cursor-pointer bg-rig-chassis p-[5px] text-left`}
      >
        <span
          className="flex h-[34px] items-center gap-2 rounded-[4px] pl-2.5 pr-12"
          style={{
            backgroundColor: block.color,
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,.25), rgba(0,0,0,.15))',
          }}
        >
          {block.knobs.map((k, i) => (
            <MiniKnob key={i} {...k} size={14} />
          ))}
        </span>
        <span
          className="mt-[5px] flex flex-1 flex-col items-center justify-center rounded-[4px] px-2 text-center"
          style={{
            backgroundColor: 'var(--color-rig-grille)',
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(255,255,255,.05) 0 2px, transparent 2px 5px), repeating-linear-gradient(-45deg, rgba(0,0,0,.25) 0 2px, transparent 2px 5px)',
          }}
        >
          <span className="font-display text-[13px] font-bold tracking-wide text-rig-plate-text">{block.typeLabel}</span>
          <span className="max-w-full truncate text-[10px] text-rig-plate-dim">{modelName}</span>
        </span>
      </button>
      {/* Chave de liga/desliga no painel (o enable D/AMP do pedal). */}
      <button
        role="switch"
        aria-checked={block.enabled}
        aria-label={switchLabel}
        onClick={onToggle}
        className="absolute right-[12px] top-[12px] h-[20px] w-[34px] rounded-full cursor-pointer bg-black/55 shadow-[inset_0_1px_3px_rgba(0,0,0,.7)]"
      >
        <span
          aria-hidden="true"
          className={`absolute top-[3px] h-[14px] w-[14px] rounded-full transition-[left,background-color] duration-150 ease-out-strong ${
            block.enabled ? 'left-[17px] bg-rig-led shadow-[0_0_6px_var(--color-rig-led)]' : 'left-[3px] bg-tank-muted'
          }`}
        />
      </button>
    </div>
  )
}
