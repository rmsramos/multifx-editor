import { useEffect } from 'react'
import { PRESET_SLOTS } from '@shared/constants'
import { useDevice } from './hooks/useDevice'
import { usePreset } from './hooks/usePreset'
import { usePresetStore } from './stores/preset-store'
import { useTranslation } from './i18n'
import Header from './components/Header'
import EditorToolbar from './components/EditorToolbar'
import PresetStrip from './components/PresetStrip'
import { type ToggleableModule } from './components/SignalChain'
import PanelView from './components/PanelView'
import RigView from './components/rig/RigView'
import { useSettingsStore } from './stores/settings-store'
import EditorLock from './components/EditorLock'
import StatusBar from './components/StatusBar'
import Toast from './components/Toast'

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
  const presets = usePresetStore((s) => s.presets)
  const dirtyIndices = usePresetStore((s) => s.dirtyIndices)
  const pedalDirtyIndices = usePresetStore((s) => s.pedalDirtyIndices)
  const lastPedalSwitchAt = usePresetStore((s) => s.lastPedalSwitchAt)
  const deviceInfo = usePresetStore((s) => s.deviceInfo)
  const syncState = usePresetStore((s) => s.syncState)
  const { t, locale } = useTranslation()
  const viewMode = useSettingsStore((s) => s.viewMode)
  const updaters = {
    onUpdatePreset: updatePreset,
    onUpdateAmp: updateAmp,
    onUpdateMod: updateMod,
    onUpdateDelay: updateDelay,
    onUpdateReverb: updateReverb,
  }

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
      {/* Navegação de presets: fora da área travada (segue ativa com bypass/afinador). */}
      <PresetStrip
        presets={presets}
        currentBank={currentBank}
        currentSlot={currentSlot}
        dirtyIndices={dirtyIndices}
        pedalDirtyIndices={pedalDirtyIndices}
        pedalSwitchAt={lastPedalSwitchAt}
        onSelect={selectPreset}
        onImport={importPreset}
        onExport={exportPreset}
      />

      <div className="flex flex-1 min-h-0">
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
              {viewMode === 'rig' ? (
                <RigView preset={currentPreset} {...updaters} />
              ) : (
                <PanelView preset={currentPreset} onChainToggle={handleChainToggle} {...updaters} />
              )}

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
