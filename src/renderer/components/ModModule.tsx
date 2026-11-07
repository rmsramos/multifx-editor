import type { ModSettings } from '@shared/types/preset'
import { decodeBlockParam, encodeBlockParam, blockAmountRange, MOD_TYPES, MOD_FX_PARAM } from '@shared/block-param'
import { MODULE_COLORS } from '../theme'
import ModuleCard from './ModuleCard'
import TypeSelector from './TypeSelector'
import Knob from './Knob'

const COLOR = MODULE_COLORS.mod

interface ModModuleProps {
  settings: ModSettings
  onChange: (settings: ModSettings) => void
  className?: string
}

// O byte FX é um knob-bloco: codifica o tipo de mod (Chorus/Phaser/Tremolo)
// + o parâmetro do tipo (Mix/Depth/Mix) 0/1-40. Ver shared/block-param.ts.
export default function ModModule({ settings, onChange, className }: ModModuleProps) {
  const block = decodeBlockParam(settings.fx)
  const range = block.type !== null ? blockAmountRange(block.type) : { min: 0, max: 40 }
  const fxLabel = block.type !== null ? MOD_FX_PARAM[block.type] : 'FX'

  return (
    <ModuleCard
      title="MOD"
      color={COLOR}
      badge={block.type === null ? 'Off' : undefined}
      enabled={settings.enabled}
      onToggle={() => onChange({ ...settings, enabled: !settings.enabled })}
      className={className}
    >
      <div className="flex flex-col items-center gap-3 w-full">
        <TypeSelector
          options={MOD_TYPES}
          value={block.type}
          color={COLOR}
          disabled={!settings.enabled}
          onChange={(type) =>
            onChange({ ...settings, fx: encodeBlockParam(type, block.type === null ? 20 : block.amount) })
          }
        />
        <div className="flex gap-5">
          <Knob
            label="Speed"
            value={settings.speed}
           
            color={COLOR}
            onChange={(speed) => onChange({ ...settings, speed })}
            disabled={!settings.enabled}
          />
          <Knob
            label={fxLabel}
            value={block.amount}
            min={range.min}
            max={range.max}
            defaultValue={20}
            color={COLOR}
            onChange={(amount) => {
              if (block.type !== null) onChange({ ...settings, fx: encodeBlockParam(block.type, amount) })
            }}
            disabled={!settings.enabled || block.type === null}
          />
        </div>
      </div>
    </ModuleCard>
  )
}
