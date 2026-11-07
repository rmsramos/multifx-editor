import { useEffect, useRef } from 'react'
import { usePresetStore } from '../stores/preset-store'
import { tr } from '../i18n'

export function useDevice() {
  const { connectionStatus, setConnectionStatus } = usePresetStore()
  // Reaplicação pós-reconexão é adiada para o próximo status do pedal (ver abaixo).
  const reapplyOnStatus = useRef(false)

  useEffect(() => {
    const unsubscribe = window.tankGApi.device.onStatusChanged((status) => {
      setConnectionStatus(status)
    })
    return unsubscribe
  }, [setConnectionStatus])

  // Estado da fila de escrita (main → renderer)
  useEffect(() => {
    const unsubscribe = window.tankGApi.sync.onStateChanged((state) => {
      usePresetStore.getState().setSyncState(state)
      if (state === 'error') {
        usePresetStore.getState().showToast(tr('toast.writeFailed'))
      }
    })
    return unsubscribe
  }, [])

  // Ao conectar: carrega os 36 presets reais do pedal — exceto se houver edições
  // locais pendentes (aí reaplica o preset atual em vez de sobrescrever o trabalho).
  useEffect(() => {
    if (connectionStatus !== 'connected') return
    const { isDirty, isCurrentDirty, showToast } = usePresetStore.getState()
    // NÃO reaplica cegamente: após um power-cycle o pedal pode ter acordado em outro
    // slot que não o que a UI mostra, e um applyLive gravaria as edições no slot
    // errado. Adia a reaplicação para o PRÓXIMO status do pedal, que só dispara se
    // banco/slot ainda baterem com a UI (ver onPedalStateChanged).
    if (isCurrentDirty) {
      reapplyOnStatus.current = true
    }
    if (!isDirty) {
      window.tankGApi.preset
        .readAll()
        .then((presets) => usePresetStore.getState().setAllPresets(presets))
        .catch((error) => {
          console.error('Falha ao ler presets do pedal:', error)
          showToast(tr('toast.readFailed'))
        })
    }
  }, [connectionStatus])

  // Sincronização pedal→UI: status (banco/slot/modo/bypass) e preset ativo
  useEffect(() => {
    const unsubscribe = window.tankGApi.device.onPedalStateChanged((status) => {
      // Reaplicação pós-reconexão gateada: só reaplica se o pedal acordou no MESMO
      // banco/slot ainda sujo que a UI mostra; senão apenas consome a flag e deixa o
      // syncFromPedal mover a UI (as edições ficam em memória para o slot delas).
      if (reapplyOnStatus.current) {
        reapplyOnStatus.current = false
        const { isCurrentDirty, currentBank, currentSlot, currentPreset } = usePresetStore.getState()
        if (
          !status.bypass &&
          status.slotIndex !== null &&
          status.bankIndex + 1 === currentBank &&
          (['A', 'B', 'C', 'D'] as const)[status.slotIndex] === currentSlot &&
          isCurrentDirty
        ) {
          window.tankGApi.preset.applyLive(currentPreset).catch((error) =>
            console.error('Falha ao reaplicar após reconexão:', error)
          )
        }
      }
      usePresetStore.getState().syncFromPedal(status)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = window.tankGApi.preset.onLiveChanged((preset) => {
      usePresetStore.getState().syncLivePreset(preset)
    })
    return unsubscribe
  }, [])

  // Registrar checker de unsaved para confirmação ao fechar
  useEffect(() => {
    window.tankGApi.app.onCheckUnsaved(() => {
      return usePresetStore.getState().isDirty
    })
  }, [])

  // Auto-(re)conexão: sonda a porta MIDI imediatamente e depois a cada 4s.
  // Desconectado + pedal apareceu → conecta; conectado + pedal sumiu → desconecta.
  // Cobre o caso do pedal ser ligado/plugado depois do app abrir.
  // A decisão usa o status REAL do main (getStatus), não o cache do renderer:
  // um evento de status perdido (reload/HMR) deixaria o cache obsoleto e a
  // sonda travada para sempre num falso "connected".
  useEffect(() => {
    let cancelled = false
    const probe = async () => {
      try {
        const [devices, status] = await Promise.all([
          window.tankGApi.device.scan(),
          window.tankGApi.device.getStatus(),
        ])
        if (cancelled) return
        const store = usePresetStore.getState()
        store.setConnectionStatus(status)
        if (status === 'connected') {
          if (devices.length === 0) await window.tankGApi.device.disconnect()
          // Info em cache no main (sem MIDI): recupera após reload/HMR também.
          else if (!store.deviceInfo) store.setDeviceInfo(await window.tankGApi.device.getInfo())
        } else {
          if (store.deviceInfo) store.setDeviceInfo(null)
          if (status !== 'connecting' && devices.length > 0) {
            store.setDeviceInfo(await window.tankGApi.device.connect(devices[0].id))
          }
        }
      } catch (error) {
        if (!cancelled) console.error('Sonda de conexão falhou:', error)
      }
    }
    probe()
    const interval = setInterval(probe, 4000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return { connectionStatus }
}
