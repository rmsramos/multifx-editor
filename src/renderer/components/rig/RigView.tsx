import { useState } from 'react'
import type { Preset } from '@shared/types/preset'
import type { RigBlockKey, ToggleableBlock } from '../../rigModel'
import RigBoard from './RigBoard'
import BlockDetail, { type BlockUpdaters } from './BlockDetail'

interface RigViewProps extends BlockUpdaters {
  preset: Preset
}

/** Modo Rig: pedaleira + controles do bloco selecionado. A seleção sobrevive à troca de preset. */
export default function RigView({ preset, ...updaters }: RigViewProps) {
  const [selected, setSelected] = useState<RigBlockKey>('amp')

  const toggle = (key: ToggleableBlock) => {
    if (key === 'amp') updaters.onUpdateAmp({ ...preset.amp, enabled: !preset.amp.enabled })
    if (key === 'mod') updaters.onUpdateMod({ ...preset.mod, enabled: !preset.mod.enabled })
    if (key === 'delay') updaters.onUpdateDelay({ ...preset.delay, enabled: !preset.delay.enabled })
    if (key === 'reverb') updaters.onUpdateReverb({ ...preset.reverb, enabled: !preset.reverb.enabled })
  }

  return (
    <div className="flex flex-col gap-4">
      <RigBoard preset={preset} selected={selected} onSelect={setSelected} onToggle={toggle} />
      <BlockDetail block={selected} preset={preset} {...updaters} />
    </div>
  )
}
