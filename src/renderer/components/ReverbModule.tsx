import type { ReverbSettings } from '@shared/types/preset'
import { decodeBlockParam, encodeBlockParam, blockAmountRange, REVERB_TYPES } from '@shared/block-param'
import { MODULE_COLORS } from '../theme'
import ModuleCard from './ModuleCard'
import TypeSelector from './TypeSelector'
import Knob from './Knob'

const COLOR = MODULE_COLORS.reverb

interface ReverbModuleProps {
  settings: ReverbSettings
  onChange: (settings: ReverbSettings) => void
  className?: string
}

// O byte Decay é um knob-bloco: codifica o tipo de reverb (Room/Spring/Cloud)
// + o decay 0/1-40 dentro do tipo. Ver shared/block-param.ts.
export default function ReverbModule({ settings, onChange, className }: ReverbModuleProps) {
  const block = decodeBlockParam(settings.decay)
  const range = block.type !== null ? blockAmountRange(block.type) : { min: 0, max: 40 }

  return (
    <ModuleCard
      title="Reverb"
      color={COLOR}
      badge={block.type === null ? 'Off' : undefined}
      enabled={settings.enabled}
      onToggle={() => onChange({ ...settings, enabled: !settings.enabled })}
      className={className}
    >
      <div className="flex flex-col items-center gap-3 w-full">
        <TypeSelector
          options={REVERB_TYPES}
          value={block.type}
          color={COLOR}
          disabled={!settings.enabled}
          onChange={(type) =>
            onChange({ ...settings, decay: encodeBlockParam(type, block.type === null ? 20 : block.amount) })
          }
        />
        <div className="flex gap-5">
          <Knob
            label="Mix"
            value={settings.mix}
           
            color={COLOR}
            onChange={(mix) => onChange({ ...settings, mix })}
            disabled={!settings.enabled}
          />
          <Knob
            label="Decay"
            value={block.amount}
            min={range.min}
            max={range.max}
            defaultValue={20}
            color={COLOR}
            onChange={(amount) => {
              if (block.type !== null) onChange({ ...settings, decay: encodeBlockParam(block.type, amount) })
            }}
            disabled={!settings.enabled || block.type === null}
          />
        </div>
      </div>
    </ModuleCard>
  )
}
