import { useCallback, useRef, useState } from 'react'
import { usePresetStore } from '../stores/preset-store'
import { PRESET_SLOTS } from '@shared/constants'
import type { PresetSlot } from '@shared/types/preset'
import { tr } from '../i18n'

const APPLY_THROTTLE_MS = 150

export function usePreset() {
  const store = usePresetStore()
  const applyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tunerBusy = useRef(false)
  const bypassBusy = useRef(false)
  const [tunerPending, setTunerPending] = useState(false)

  // Leading throttle: o primeiro evento de cada janela de 150ms inicia o timer;
  // ao disparar, lê o estado atual do store → sempre envia o valor mais recente.
  const scheduleApply = useCallback(() => {
    if (applyTimer.current) return
    usePresetStore.getState().setApplyPending(true)
    applyTimer.current = setTimeout(() => {
      applyTimer.current = null
      const { systemMode, bypass, setApplyPending } = usePresetStore.getState()
      if (systemMode === 'tuner' || bypass) { setApplyPending(false); return }
      const { currentPreset, showToast } = usePresetStore.getState()
      window.tankGApi.preset.applyLive(currentPreset)
        .catch((error) => {
          console.error('Falha ao aplicar ao vivo:', error)
          showToast(tr('toast.applyFailed'))
        })
        .finally(() => {
          // Só limpa se nenhum timer mais novo foi armado durante o voo — senão
          // o apply encadeado rodaria sem a guarda de eco (leituras do pedal
          // ingeridas no meio da escrita).
          if (applyTimer.current === null) usePresetStore.getState().setApplyPending(false)
        })
    }, APPLY_THROTTLE_MS)
  }, [])

  const updatePreset = useCallback((updates: Parameters<typeof store.updatePreset>[0]) => {
    usePresetStore.getState().updatePreset(updates)
    scheduleApply()
  }, [scheduleApply])

  const updateAmp = useCallback((updates: Parameters<typeof store.updateAmp>[0]) => {
    usePresetStore.getState().updateAmp(updates)
    scheduleApply()
  }, [scheduleApply])

  const updateMod = useCallback((updates: Parameters<typeof store.updateMod>[0]) => {
    usePresetStore.getState().updateMod(updates)
    scheduleApply()
  }, [scheduleApply])

  const updateDelay = useCallback((updates: Parameters<typeof store.updateDelay>[0]) => {
    usePresetStore.getState().updateDelay(updates)
    scheduleApply()
  }, [scheduleApply])

  const updateReverb = useCallback((updates: Parameters<typeof store.updateReverb>[0]) => {
    usePresetStore.getState().updateReverb(updates)
    scheduleApply()
  }, [scheduleApply])

  // Troca o preset ativo: PC no pedal + modelo local. Se o slot foi editado
  // localmente, reaplica os parâmetros por cima do que a flash carregou.
  const selectPreset = useCallback(async (bank: number, slot: PresetSlot) => {
    usePresetStore.getState().mutePedalSync(1500) // ação da UI: ignora leituras velhas em trânsito
    const { setBank, setSlot, dirtyIndices, setBypass, showToast } = usePresetStore.getState()
    setBank(bank)
    setSlot(slot)
    const index = (bank - 1) * 4 + PRESET_SLOTS.indexOf(slot)
    try {
      await window.tankGApi.preset.select(index)
      // O PC pode sair bem depois do clique (fila atrás do polling, ~1 s por leitura).
      // O silêncio precisa cobrir a recarga do buffer APÓS o PC, não só após o clique —
      // senão uma leitura no meio da carga suja o slot recém-selecionado.
      usePresetStore.getState().mutePedalSync(1500)
      setBypass(false) // o Program Change recarrega o preset sem bypass — sincroniza o indicador
      if (dirtyIndices.has(index)) scheduleApply()
    } catch (error) {
      console.error('Falha ao trocar preset:', error)
      showToast(tr('toast.selectFailed'))
    }
  }, [scheduleApply])

  // Grava o preset atual no slot da FLASH do pedal (persiste após desligar).
  const saveToDevice = useCallback(async () => {
    const { currentPreset, currentBank, currentSlot, markSlotSaved, showToast } = usePresetStore.getState()
    const index = (currentBank - 1) * 4 + PRESET_SLOTS.indexOf(currentSlot)
    try {
      await window.tankGApi.preset.save(index, currentPreset)
      markSlotSaved(index)
      showToast(tr('toast.presetSaved', { slot: `${currentBank}${currentSlot}` }), 'success')
    } catch (error) {
      console.error('Falha ao salvar na flash:', error)
      showToast(tr('toast.saveFailed'))
    }
  }, [])

  // Descarta as edições não salvas do slot atual e restaura a versão salva —
  // tanto na tela quanto no pedal (reaplica ao vivo, como qualquer edição).
  const discardEdits = useCallback(() => {
    const { isCurrentDirty, discardCurrentEdits, mutePedalSync } = usePresetStore.getState()
    if (!isCurrentDirty) return
    mutePedalSync(1500) // ação da UI: ignora leituras em trânsito enquanto restaura
    discardCurrentEdits()
    scheduleApply() // reaplica a versão salva ao pedal (o som volta ao estado anterior)
  }, [scheduleApply])

  const toggleTuner = useCallback(async () => {
    // Ignora cliques enquanto uma navegação está em voo — evita dois tuner.set
    // concorrentes (o segundo leria o modo já otimisticamente trocado e desfaria).
    if (tunerBusy.current) return
    tunerBusy.current = true
    setTunerPending(true)
    const { systemMode, previousMode, setSystemMode, setPreviousMode, showToast } = usePresetStore.getState()
    const original = systemMode
    const entering = systemMode !== 'tuner'
    const target = entering ? 'tuner' : previousMode
    // Atualização otimista: o afinador navega em malha fechada (~1-2s), então o
    // toggle move na hora e o pedal reconcilia depois — sem esse período "morto"
    // o clique parecia não fazer nada até o afinador engatar no aparelho.
    if (entering) setPreviousMode(systemMode)
    setSystemMode(target)
    try {
      const mode = await window.tankGApi.tuner.set(target)
      setSystemMode(mode) // reconcilia com o modo real retornado pelo pedal
    } catch (error) {
      setSystemMode(original) // reverte a mudança otimista
      console.error('Falha ao alternar afinador:', error)
      showToast(tr('toast.tunerFailed'), 'error')
    } finally {
      tunerBusy.current = false
      setTunerPending(false)
    }
  }, [])

  // Bypass global: comando dedicado no pedal (não é o enable dos efeitos). Estado
  // otimista — não há footswitch físico de bypass, então só o app o altera.
  const toggleBypass = useCallback(async () => {
    if (bypassBusy.current) return
    bypassBusy.current = true
    const { bypass, currentBank, currentSlot, setBypass, showToast } = usePresetStore.getState()
    const index = (currentBank - 1) * 4 + PRESET_SLOTS.indexOf(currentSlot)
    const next = !bypass
    try {
      usePresetStore.getState().mutePedalSync(1500) // ação da UI: ignora leituras velhas em trânsito
      await window.tankGApi.bypass.set(next, index)
      setBypass(next)
    } catch (error) {
      console.error('Falha ao alternar bypass:', error)
      showToast(tr('toast.bypassFailed'), 'error')
    } finally {
      bypassBusy.current = false
    }
  }, [])


  const importPreset = useCallback(async () => {
    try {
      const preset = await window.tankGApi.preset.importFile()
      if (!preset) return // usuário cancelou o diálogo
      // Lê o slot DEPOIS do diálogo: o usuário pode ter trocado de preset enquanto ele
      // estava aberto. Herda o slot atual e descarta bank/slot do arquivo (senão o
      // conteúdo importado alega pertencer a outro slot e corrompe o índice depois).
      const { currentBank, currentSlot, updatePreset, showToast } = usePresetStore.getState()
      updatePreset({ ...preset, bank: currentBank, slot: currentSlot })
      scheduleApply() // aplica ao vivo no pedal, como qualquer outra edição
      showToast(tr('toast.presetImported', { slot: `${currentBank}${currentSlot}` }), 'success')
    } catch (error) {
      console.error('Falha ao importar preset:', error)
      usePresetStore.getState().showToast(tr('toast.importFailed'), 'error')
    }
  }, [scheduleApply])

  const exportPreset = useCallback(async () => {
    try {
      const { currentPreset } = usePresetStore.getState()
      await window.tankGApi.preset.exportFile(currentPreset)
    } catch (error) {
      console.error('Falha ao exportar preset:', error)
      usePresetStore.getState().showToast(tr('toast.exportFailed'), 'error')
    }
  }, [])


  return {
    currentPreset: store.currentPreset,
    currentBank: store.currentBank,
    currentSlot: store.currentSlot,
    isDirty: store.isDirty,
    isCurrentDirty: store.isCurrentDirty,
    bypass: store.bypass,
    systemMode: store.systemMode,
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
    toggleTuner,
    tunerPending,
  }
}
