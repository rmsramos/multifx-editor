import { useEffect } from 'react'
import { PRESET_SLOTS } from '@shared/constants'
import { useDevice } from './hooks/useDevice'
import { usePreset } from './hooks/usePreset'
import { usePresetStore } from './stores/preset-store'
import { useTranslation } from './i18n'
import Header from './components/Header'
import EditorToolbar from './components/EditorToolbar'
import PresetGrid from './components/PresetGrid'
import AmpModule from './components/AmpModule'
import ReverbModule from './components/ReverbModule'
import DelayModule from './components/DelayModule'
import ModModule from './components/ModModule'
import NoiseGateModule from './components/NoiseGateModule'
import IrCabModule from './components/IrCabModule'
import SignalChain, { type ToggleableModule } from './components/SignalChain'
import EditorLock from './components/EditorLock'
import StatusBar from './components/StatusBar'
import Toast from './components/Toast'

const sidebarBtn =
  'px-2 py-1.5 text-xs rounded bg-tank-raised border border-tank-border text-tank-muted hover:text-tank-text hover:border-tank-muted cursor-pointer'

function App(): React.JSX.Element {
  const { connectionStatus } = useDevice()
  const {
    currentPreset,
    currentBank,
    currentSlot,
    isDirty,
    isCurrentDirty,
    bypass,
    updatePreset,
    updateAmp,
    updateMod,
    updateDelay,
    updateReverb,
    toggleBypass,
    selectPreset,
    saveToDevice,
    discardEdits,
    importPreset,
    exportPreset,
    systemMode,
    toggleTuner,
    tunerPending,
  } = usePreset()
  const dirtyIndices = usePresetStore((s) => s.dirtyIndices)
  const pedalDirtyIndices = usePresetStore((s) => s.pedalDirtyIndices)
  const lastPedalSwitchAt = usePresetStore((s) => s.lastPedalSwitchAt)
  const deviceInfo = usePresetStore((s) => s.deviceInfo)
  const syncState = usePresetStore((s) => s.syncState)
  const { t, locale } = useTranslation()

  const handleChainToggle = (module: ToggleableModule) => {
    const updaters = { amp: updateAmp, mod: updateMod, delay: updateDelay, reverb: updateReverb }
    updaters[module]({ ...currentPreset[module], enabled: !currentPreset[module].enabled } as never)
  }

  const locked = bypass || systemMode === 'tuner'

  const handleRetry = () => {
    window.tankGApi.sync.retry().catch((error) => console.error('Retry falhou:', error))
  }

  // Propaga o idioma ao main process (ex.: diálogo nativo de fechar sem salvar).
  useEffect(() => {
    window.tankGApi.app.setLocale(locale)
  }, [locale])

  return (
    <div className="flex flex-col h-screen bg-tank-bg text-tank-text">
      <Header connectionStatus={connectionStatus} />

      <div className="flex flex-1 min-h-0">
        {/* Sidebar de presets */}
        <aside className="w-[210px] flex-none flex flex-col border-r border-tank-border bg-tank-card p-3 overflow-y-auto">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-tank-muted mb-2">
            {t('nav.presets')}
          </h2>
          <PresetGrid
            currentBank={currentBank}
            currentSlot={currentSlot}
            dirtyIndices={dirtyIndices}
            pedalDirtyIndices={pedalDirtyIndices}
            pedalSwitchAt={lastPedalSwitchAt}
            onSelect={selectPreset}
          />
          {/* Importar/Exportar agem sobre o preset selecionado — ficam junto do grid. */}
          <div className="mt-auto pt-4 grid grid-cols-2 gap-2">
            <button onClick={importPreset} title={t('header.importTitle')} className={sidebarBtn}>
              {t('header.import')}
            </button>
            <button onClick={exportPreset} title={t('header.exportTitle')} className={sidebarBtn}>
              {t('header.export')}
            </button>
          </div>
        </aside>

        {/* Editor */}
        <main className="flex-1 min-w-0 flex flex-col">
          <EditorToolbar
            presetLabel={`${currentBank}${currentSlot}`}
            ledColor={currentPreset.color}
            onLedColorChange={(color) => updatePreset({ color })}
            bypass={bypass}
            onBypassToggle={toggleBypass}
            connectionStatus={connectionStatus}
            syncState={syncState}
            onRetry={handleRetry}
            onSave={saveToDevice}
            onDiscard={discardEdits}
            isCurrentDirty={isCurrentDirty}
            tunerActive={systemMode === 'tuner'}
            tunerPending={tunerPending}
            onTunerToggle={toggleTuner}
          />
          <div className="relative flex-1 min-h-0">
            {/* Editor travado (sem interação + esmaecido) com bypass ou afinador ativos —
                editar não faz sentido (sinal bypassado / saída mutada). A toolbar e os
                presets seguem ativos; o EditorLock explica o porquê e oferece a saída. */}
            <div
              aria-disabled={locked}
              className={`@container h-full overflow-y-auto p-4 flex flex-col gap-4 transition-opacity duration-200 ${
                locked ? 'pointer-events-none select-none opacity-30' : ''
              }`}
              inert={locked}
            >
              <SignalChain preset={currentPreset} onToggle={handleChainToggle} />

              {/* Linha 1: GATE → AMP (núcleo do som). Gate com a largura do conteúdo. */}
              <div className="flex items-stretch gap-4">
                <NoiseGateModule
                  value={currentPreset.noiseGate}
                  onChange={(noiseGate) => updatePreset({ noiseGate })}
                  className="flex-none"
                />
                <AmpModule settings={currentPreset.amp} onChange={updateAmp} className="flex-1" />
              </div>

              {/* Linha 2: MOD → DELAY → REVERB → IR CAB. 4 colunas a partir de 60rem de área
                  (cada card ~230 px, o mínimo para os 3 segmentos de tipo sem cortar); abaixo
                  disso quebra em 2+2 — na janela mínima (1120 px) já é 2+2. */}
              <div className="grid grid-cols-2 @min-[60rem]:grid-cols-4 gap-4">
                <ModModule settings={currentPreset.mod} onChange={updateMod} />
                <DelayModule settings={currentPreset.delay} onChange={updateDelay} />
                <ReverbModule settings={currentPreset.reverb} onChange={updateReverb} />
                <IrCabModule value={currentPreset.irCab} onChange={(value) => updatePreset({ irCab: value })} />
              </div>

              <div className="space-y-1 text-[11px] leading-snug text-tank-muted">
                <p>{t('models.disclaimer')}</p>
                <p>{t('app.disclaimer')}</p>
                <p>{t('app.flashWarning')}</p>
              </div>
            </div>
            {locked && (
              <EditorLock
                mode={systemMode === 'tuner' ? 'tuner' : 'bypass'}
                pending={tunerPending}
                onExit={systemMode === 'tuner' ? toggleTuner : toggleBypass}
              />
            )}
          </div>
        </main>
      </div>

      <StatusBar
        currentBank={currentBank}
        currentSlot={currentSlot}
        isDirty={isDirty}
        isCurrentDirty={isCurrentDirty}
        isCurrentPedalDirty={pedalDirtyIndices.has((currentBank - 1) * 4 + PRESET_SLOTS.indexOf(currentSlot))}
        deviceInfo={connectionStatus === 'connected' ? deviceInfo : null}
      />
      <Toast />
    </div>
  )
}

export default App
