import type { DelaySettings } from '@shared/types/preset'
import { decodeBlockParam, encodeBlockParam, blockAmountRange, DELAY_TYPES } from '@shared/block-param'
import { MODULE_COLORS } from '../theme'
import ModuleCard from './ModuleCard'
import TypeSelector from './TypeSelector'
import Knob from './Knob'

const COLOR = MODULE_COLORS.delay

interface DelayModuleProps {
  settings: DelaySettings
  onChange: (settings: DelaySettings) => void
  className?: string
}

// O byte Mix é um knob-bloco: codifica o tipo de delay (Analog/Tape/Dual)
// + o mix 0/1-40 dentro do tipo. Ver shared/block-param.ts.
export default function DelayModule({ settings, onChange, className }: DelayModuleProps) {
  const block = decodeBlockParam(settings.mix)
  const range = block.type !== null ? blockAmountRange(block.type) : { min: 0, max: 40 }

  return (
    <ModuleCard
      title="Delay"
      color={COLOR}
      badge={block.type === null ? 'Off' : undefined}
      enabled={settings.enabled}
      onToggle={() => onChange({ ...settings, enabled: !settings.enabled })}
      className={className}
    >
      <div className="flex flex-col items-center gap-3 w-full">
        <TypeSelector
          options={DELAY_TYPES}
          value={block.type}
          color={COLOR}
          disabled={!settings.enabled}
          onChange={(type) =>
            onChange({ ...settings, mix: encodeBlockParam(type, block.type === null ? 20 : block.amount) })
          }
        />
        <div className="flex gap-5">
          <Knob
            label="Time"
            value={settings.time}
           
            color={COLOR}
            onChange={(time) => onChange({ ...settings, time })}
            disabled={!settings.enabled}
          />
          <Knob
            label="Mix"
            value={block.amount}
            min={range.min}
            max={range.max}
            defaultValue={20}
            color={COLOR}
            onChange={(amount) => {
              if (block.type !== null) onChange({ ...settings, mix: encodeBlockParam(block.type, amount) })
            }}
            disabled={!settings.enabled || block.type === null}
          />
        </div>
      </div>
    </ModuleCard>
  )
}
