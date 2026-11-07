import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDevice } from '@renderer/hooks/useDevice'
import { usePresetStore } from '@renderer/stores/preset-store'
import type { PedalStatus } from '@shared/types/device'

const scan = vi.fn()
const connect = vi.fn().mockResolvedValue({ id: 'hw:4,0,0', name: 'Tank G' })
const disconnect = vi.fn().mockResolvedValue(undefined)
const getStatus = vi.fn()
const readAll = vi.fn().mockResolvedValue([])

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as any).tankGApi = {
    app: { onCheckUnsaved: vi.fn() },
    device: {
      scan,
      connect,
      disconnect,
      getStatus,
      getInfo: vi.fn().mockResolvedValue({ id: 'hw:4,0,0', name: 'Tank G', model: 'TANK-Gv2', firmware: 96 }),
      onStatusChanged: vi.fn().mockReturnValue(() => {}),
      onPedalStateChanged: vi.fn().mockReturnValue(() => {}),
    },
    preset: {
      applyLive: vi.fn().mockResolvedValue(undefined),
      readAll,
      onLiveChanged: vi.fn().mockReturnValue(() => {}),
    },
    sync: { onStateChanged: vi.fn().mockReturnValue(() => {}) },
    tuner: {},
  }
  usePresetStore.setState({ isDirty: false, isCurrentDirty: false })
})

describe('useDevice: sonda de reconexão usa o status real do main', () => {
  it('reconecta mesmo com cache do renderer obsoleto em "connected"', async () => {
    // Cenário do deadlock: renderer perdeu o evento de disconnect (reload/HMR)
    // e ainda acha que está conectado; o main está desconectado e o pedal presente.
    usePresetStore.setState({ connectionStatus: 'connected' })
    getStatus.mockResolvedValue('disconnected')
    scan.mockResolvedValue([{ id: 'hw:4,0,0', name: 'Tank G' }])

    renderHook(() => useDevice())
    await act(async () => {})

    expect(connect).toHaveBeenCalledWith('hw:4,0,0')
  })

  it('desconecta quando o main diz conectado mas o pedal sumiu das portas', async () => {
    usePresetStore.setState({ connectionStatus: 'connected' })
    getStatus.mockResolvedValue('connected')
    scan.mockResolvedValue([])

    renderHook(() => useDevice())
    await act(async () => {})

    expect(disconnect).toHaveBeenCalled()
    expect(connect).not.toHaveBeenCalled()
  })

  it('não inicia conexão enquanto o main está em "connecting"', async () => {
    usePresetStore.setState({ connectionStatus: 'disconnected' })
    getStatus.mockResolvedValue('connecting')
    scan.mockResolvedValue([{ id: 'hw:4,0,0', name: 'Tank G' }])

    renderHook(() => useDevice())
    await act(async () => {})

    expect(connect).not.toHaveBeenCalled()
    expect(disconnect).not.toHaveBeenCalled()
  })

  it('reconcilia o store do renderer com o status real do main', async () => {
    usePresetStore.setState({ connectionStatus: 'connected' })
    getStatus.mockResolvedValue('disconnected')
    scan.mockResolvedValue([])

    renderHook(() => useDevice())
    await act(async () => {})

    expect(usePresetStore.getState().connectionStatus).toBe('disconnected')
  })
})

describe('useDevice: reaplicação pós-reconexão é gateada pelo status do pedal', () => {
  // Captura o callback do onPedalStateChanged e arma o cenário "conectado + slot
  // atual sujo" (a flag reapplyOnStatus fica armada na montagem). O primeiro status
  // do pedal decide se reaplica.
  function armReconnect(): (s: PedalStatus) => void {
    let pedalCb: ((s: PedalStatus) => void) | null = null
    ;(window as any).tankGApi.device.onPedalStateChanged = vi.fn((cb: (s: PedalStatus) => void) => {
      pedalCb = cb
      return () => {}
    })
    getStatus.mockResolvedValue('connected')
    scan.mockResolvedValue([{ id: 'hw:4,0,0', name: 'Tank G' }])
    usePresetStore.setState({
      connectionStatus: 'connected',
      isDirty: true,
      isCurrentDirty: true,
      currentBank: 1,
      currentSlot: 'A',
    })
    renderHook(() => useDevice())
    return (status) => pedalCb!(status)
  }

  it('reaplica quando o pedal acorda no mesmo banco/slot ainda sujo', async () => {
    const fireStatus = armReconnect()
    await act(async () => {})

    const applyLive = (window as any).tankGApi.preset.applyLive
    act(() => fireStatus({ bankIndex: 0, slotIndex: 0, mode: 'normal', bypass: false }))

    expect(applyLive).toHaveBeenCalledTimes(1)
  })

  it('NÃO reaplica quando o pedal acordou em outro slot (edições ficam em memória)', async () => {
    const fireStatus = armReconnect()
    await act(async () => {})

    const applyLive = (window as any).tankGApi.preset.applyLive
    act(() => fireStatus({ bankIndex: 0, slotIndex: 1, mode: 'normal', bypass: false }))

    expect(applyLive).not.toHaveBeenCalled()
  })

  it('em bypass, consome a flag sem reaplicar', async () => {
    const fireStatus = armReconnect()
    await act(async () => {})

    const applyLive = (window as any).tankGApi.preset.applyLive
    act(() => fireStatus({ bankIndex: 0, slotIndex: null, mode: null, bypass: true }))

    expect(applyLive).not.toHaveBeenCalled()
  })
})
