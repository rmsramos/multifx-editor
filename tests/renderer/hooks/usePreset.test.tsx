import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePreset } from '@renderer/hooks/usePreset'
import { usePresetStore } from '@renderer/stores/preset-store'

const applyLive = vi.fn().mockResolvedValue(undefined)
const select = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  vi.useFakeTimers()
  applyLive.mockClear()
  select.mockClear()
  ;(window as any).tankGApi = { preset: { applyLive, select } }
  usePresetStore.setState({
    currentBank: 1, currentSlot: 'A',
    dirtyIndices: new Set<number>(), isDirty: false, isCurrentDirty: false,
  })
})
afterEach(() => vi.useRealTimers())

describe('usePreset: live apply', () => {
  it('edição agenda applyLive com throttle de 150ms', () => {
    const { result } = renderHook(() => usePreset())
    act(() => result.current.updateAmp({ gain: 90 }))
    expect(applyLive).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(150))
    expect(applyLive).toHaveBeenCalledTimes(1)
    expect(applyLive.mock.calls[0][0].amp.gain).toBe(90)
  })

  it('várias edições dentro da janela disparam um único applyLive (com o último valor)', () => {
    const { result } = renderHook(() => usePreset())
    act(() => {
      result.current.updateAmp({ gain: 70 })
      result.current.updateAmp({ gain: 80 })
      result.current.updateAmp({ gain: 99 })
    })
    act(() => vi.advanceTimersByTime(150))
    expect(applyLive).toHaveBeenCalledTimes(1)
    expect(applyLive.mock.calls[0][0].amp.gain).toBe(99)
  })

  it('selectPreset envia Program Change e NÃO reaplica preset limpo', async () => {
    const { result } = renderHook(() => usePreset())
    await act(async () => result.current.selectPreset(2, 'B'))
    expect(select).toHaveBeenCalledWith(5) // (2-1)*4 + 1
    act(() => vi.advanceTimersByTime(300))
    expect(applyLive).not.toHaveBeenCalled()
  })

  it('selectPreset silencia a sync por 1,5 s a partir da troca CONCLUÍDA, não do clique', async () => {
    // PC demora 3 s (fila atrás do polling): o silêncio tem de valer depois disso.
    select.mockImplementationOnce(async () => { vi.advanceTimersByTime(3000) })
    const { result } = renderHook(() => usePreset())
    await act(async () => result.current.selectPreset(2, 'B'))
    expect(usePresetStore.getState().pedalSyncMutedUntil).toBeGreaterThanOrEqual(Date.now() + 1400)
  })

  it('selectPreset reaplica preset que estava modificado', async () => {
    usePresetStore.setState({ dirtyIndices: new Set([5]) })
    const { result } = renderHook(() => usePreset())
    await act(async () => result.current.selectPreset(2, 'B'))
    act(() => vi.advanceTimersByTime(150))
    expect(applyLive).toHaveBeenCalledTimes(1)
  })
})

describe('usePreset: descartar edições', () => {
  it('reverte o slot atual à baseline e reaplica a versão salva ao pedal', () => {
    const { result } = renderHook(() => usePreset())
    act(() => result.current.updateAmp({ gain: 99 }))
    act(() => vi.advanceTimersByTime(150))
    applyLive.mockClear()

    act(() => result.current.discardEdits())
    expect(usePresetStore.getState().currentPreset.amp.gain).toBe(64) // baseline
    expect(usePresetStore.getState().isCurrentDirty).toBe(false)

    act(() => vi.advanceTimersByTime(150))
    expect(applyLive).toHaveBeenCalledTimes(1)
    expect(applyLive.mock.calls[0][0].amp.gain).toBe(64) // pedal recebe a versão salva
  })

  it('não faz nada nem reaplica quando não há edição', () => {
    const { result } = renderHook(() => usePreset())
    act(() => result.current.discardEdits())
    act(() => vi.advanceTimersByTime(150))
    expect(applyLive).not.toHaveBeenCalled()
  })
})

describe('usePreset: afinador (otimista)', () => {
  it('entra no afinador otimisticamente antes do pedal confirmar e reconcilia depois', async () => {
    let resolveTuner: (mode: string) => void = () => {}
    const tunerSet = vi.fn(() => new Promise((r) => { resolveTuner = r }))
    ;(window as any).tankGApi = { preset: { applyLive, select }, tuner: { set: tunerSet } }
    usePresetStore.setState({ systemMode: 'normal', previousMode: 'normal' })

    const { result } = renderHook(() => usePreset())
    let pending: Promise<void>
    act(() => { pending = result.current.toggleTuner() })

    // Otimista: systemMode já é 'tuner' e o botão está pendente, mesmo sem o pedal responder.
    expect(usePresetStore.getState().systemMode).toBe('tuner')
    expect(result.current.tunerPending).toBe(true)
    expect(tunerSet).toHaveBeenCalledWith('tuner')

    await act(async () => { resolveTuner('tuner'); await pending })
    expect(usePresetStore.getState().systemMode).toBe('tuner')
    expect(result.current.tunerPending).toBe(false)
  })

  it('reverte a mudança otimista se o pedal falhar', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const tunerSet = vi.fn().mockRejectedValue(new Error('sem ACK'))
    const showToast = vi.fn()
    ;(window as any).tankGApi = { preset: { applyLive, select }, tuner: { set: tunerSet } }
    usePresetStore.setState({ systemMode: 'normal', previousMode: 'normal', showToast })

    const { result } = renderHook(() => usePreset())
    await act(async () => { await result.current.toggleTuner() })

    expect(usePresetStore.getState().systemMode).toBe('normal') // revertido
    expect(result.current.tunerPending).toBe(false)
    expect(showToast).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})

describe('usePreset: import/export', () => {
  const imported = {
    bank: 9, slot: 'D',
    noiseGate: 10,
    amp: { enabled: true, type: '1J120_CL · JC-120 Jazz Chorus', gain: 12, treble: 1, middle: 2, bass: 3, volume: 4 },
    mod: { enabled: false, speed: 5, fx: 6 },
    delay: { enabled: false, time: 7, mix: 8 },
    reverb: { enabled: false, mix: 9, decay: 11 },
    irCab: 3,
    color: { r: 1, g: 2, b: 3 },
  }

  it('importa herdando o slot atual (descarta bank/slot do arquivo) e aplica ao vivo', async () => {
    const importFile = vi.fn().mockResolvedValue(imported)
    ;(window as any).tankGApi = { preset: { applyLive, select, importFile } }
    usePresetStore.setState({ currentBank: 3, currentSlot: 'C' })

    const { result } = renderHook(() => usePreset())
    await act(async () => { await result.current.importPreset() })

    const cur = usePresetStore.getState().currentPreset
    expect(cur.bank).toBe(3)       // slot atual, não o 9D do arquivo
    expect(cur.slot).toBe('C')
    expect(cur.amp.gain).toBe(12)  // conteúdo veio do arquivo
    expect(cur.irCab).toBe(3)
    act(() => vi.advanceTimersByTime(150))
    expect(applyLive).toHaveBeenCalledTimes(1)
  })

  it('import cancelado (null) não altera nada nem aplica ao vivo', async () => {
    const importFile = vi.fn().mockResolvedValue(null)
    ;(window as any).tankGApi = { preset: { applyLive, select, importFile } }
    const { result } = renderHook(() => usePreset())
    await act(async () => { await result.current.importPreset() })
    act(() => vi.advanceTimersByTime(150))
    expect(applyLive).not.toHaveBeenCalled()
  })
})
