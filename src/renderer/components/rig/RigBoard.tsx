import { Fragment } from 'react'
import type { Preset } from '@shared/types/preset'
import type { MessageKey } from '@shared/i18n'
import { rigBlocks, cabCones, type RigBlockKey, type ToggleableBlock } from '../../rigModel'
import { ampName } from '../../presetMeta'
import { useTranslation } from '../../i18n'
import PedalBlock from './PedalBlock'
import AmpHead from './AmpHead'
import CabBlock from './CabBlock'

interface RigBoardProps {
  preset: Preset
  selected: RigBlockKey
  onSelect: (key: RigBlockKey) => void
  onToggle: (key: ToggleableBlock) => void
}

export const BLOCK_NAME_KEYS: Record<RigBlockKey, MessageKey> = {
  gate: 'chain.gate',
  amp: 'chain.amp',
  mod: 'chain.mod',
  delay: 'chain.delay',
  reverb: 'chain.reverb',
  cab: 'chain.cab',
}

/** Pedaleira: IN → Gate → Amp → Mod → Delay → Reverb → Cab → OUT (ordem fixa do Tank-G). */
export default function RigBoard({ preset, selected, onSelect, onToggle }: RigBoardProps) {
  const { t } = useTranslation()

  return (
    <div
      role="group"
      aria-label={t('rig.label')}
      className="flex items-center justify-center overflow-hidden rounded-xl border border-tank-border px-5 py-7"
      style={{
        // Trilhos de uma pedalboard: frisos horizontais discretos sob os pedais.
        backgroundColor: 'var(--color-rig-board)',
        backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 26px, rgba(0,0,0,.35) 26px 30px, rgba(255,255,255,.025) 30px 31px)',
      }}
    >
      <Jack label={t('rig.in')} />
      {rigBlocks(preset).map((block) => {
        const name = t(BLOCK_NAME_KEYS[block.key])
        const common = {
          block,
          selectLabel: t('rig.select', { block: name }),
          selected: selected === block.key,
          onSelect: () => onSelect(block.key),
        }
        const toggle = block.toggleable ? () => onToggle(block.key as ToggleableBlock) : undefined
        const footswitchLabel = t('rig.footswitch', { block: name })
        return (
          <Fragment key={block.key}>
            <Cable />
            {block.key === 'amp' ? (
              <AmpHead {...common} modelName={ampName(preset.amp.type)} switchLabel={footswitchLabel} onToggle={toggle!} />
            ) : block.key === 'cab' ? (
              <CabBlock {...common} cones={cabCones(preset.irCab)} />
            ) : (
              <PedalBlock {...common} name={name} footswitchLabel={footswitchLabel} onToggle={toggle} />
            )}
          </Fragment>
        )
      })}
      <Cable />
      <Jack label={t('rig.out')} />
    </div>
  )
}

function Cable() {
  return <span aria-hidden="true" className="h-[4px] w-5 flex-none rounded-full bg-rig-cable shadow-[0_1px_0_rgba(255,255,255,.05)]" />
}

function Jack({ label }: { label: string }) {
  return (
    <span aria-hidden="true" className="flex flex-none flex-col items-center gap-1.5">
      <span className="h-3.5 w-3.5 rounded-full border-2 border-rig-jack bg-rig-hole" />
      <span className="font-display text-[10px] font-semibold tracking-wider text-tank-muted">{label}</span>
    </span>
  )
}
