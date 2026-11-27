import type { Preset } from '@shared/types/preset'
import type { BlockUpdaters } from './rig/BlockDetail'
import SignalChain, { type ToggleableModule } from './SignalChain'
import NoiseGateModule from './NoiseGateModule'
import AmpModule from './AmpModule'
import ModModule from './ModModule'
import DelayModule from './DelayModule'
import ReverbModule from './ReverbModule'
import IrCabModule from './IrCabModule'

interface PanelViewProps extends BlockUpdaters {
  preset: Preset
  onChainToggle: (module: ToggleableModule) => void
}

/** Modo Painel: a cadeia em chips + um card por bloco (o layout original do editor). */
export default function PanelView({
  preset, onChainToggle, onUpdatePreset, onUpdateAmp, onUpdateMod, onUpdateDelay, onUpdateReverb,
}: PanelViewProps) {
  return (
    <>
      <SignalChain preset={preset} onToggle={onChainToggle} />

      {/* Linha 1: GATE → AMP (núcleo do som). Gate com a largura do conteúdo. */}
      <div className="flex items-stretch gap-4">
        <NoiseGateModule
          value={preset.noiseGate}
          onChange={(noiseGate) => onUpdatePreset({ noiseGate })}
          className="flex-none"
        />
        <AmpModule settings={preset.amp} onChange={onUpdateAmp} className="flex-1" />
      </div>

      {/* Linha 2: MOD → DELAY → REVERB → IR CAB. 4 colunas a partir de 60rem de área
          (cada card ~230 px, o mínimo para os 3 segmentos de tipo sem cortar); abaixo
          disso quebra em 2+2. Sem a lateral de presets, a janela mínima já dá 4 colunas. */}
      <div className="grid grid-cols-2 @min-[60rem]:grid-cols-4 gap-4">
        <ModModule settings={preset.mod} onChange={onUpdateMod} />
        <DelayModule settings={preset.delay} onChange={onUpdateDelay} />
        <ReverbModule settings={preset.reverb} onChange={onUpdateReverb} />
        <IrCabModule value={preset.irCab} onChange={(irCab) => onUpdatePreset({ irCab })} />
      </div>
    </>
  )
}
