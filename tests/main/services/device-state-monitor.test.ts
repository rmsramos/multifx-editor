import { describe, it, expect, vi } from 'vitest'
import { DeviceStateMonitor } from '../../../src/main/services/device-state-monitor'
import type { PedalStatus } from '../../../src/shared/types/device'

const status = (over: Partial<PedalStatus> = {}): PedalStatus =>
  ({ bankIndex: 0, slotIndex: 0, mode: 'normal', bypass: false, ...over })
const LIVE_A = Uint8Array.from({ length: 21 }, (_, i) => i)

function makeMonitor(readStatus: () => Promise<PedalStatus>, readLive: () => Promise<Uint8Array | null>) {
  const emitStatus = vi.fn(); const emitLive = vi.fn()
  const monitor = new DeviceStateMonitor(readStatus, readLive, () => true, emitStatus, emitLive)
  return { monitor, emitStatus, emitLive }
}

describe('DeviceStateMonitor', () => {
  it('emite status em TODO tick bem-sucedido (dedup fica com o renderer)', async () => {
    const { monitor, emitStatus } = makeMonitor(async () => status(), async () => null)
    await monitor.tick(); await monitor.tick()
    expect(emitStatus).toHaveBeenCalledTimes(2)
  })

  it('troca de slot dispara leitura IMEDIATA do preset ativo no mesmo tick', async () => {
    let cur = status()
    const readLive = vi.fn(async () => LIVE_A)
    const { monitor } = makeMonitor(async () => cur, readLive)
    await monitor.tick()             // slot 0: slotChanged (last=null) → lê live
    cur = status({ slotIndex: 1 })
    await monitor.tick()             // slot 1: slotChanged → lê live IMEDIATO (não espera tick par)
    expect(readLive).toHaveBeenCalledTimes(2)
  })

  it('emite a live em TODA leitura do preset ativo (sem dedup no monitor)', async () => {
    // A alternância ainda limita as LEITURAS (ticks 1,2,4 de 4 → 3 leituras); cada
    // leitura, com a verificação passando, vira uma emissão — mesmo payload idêntico.
    const readLive = vi.fn(async () => LIVE_A)
    const { monitor, emitLive } = makeMonitor(async () => status(), readLive)
    await monitor.tick() // 1º: slotChanged → lê
    await monitor.tick() // 2º: tick par → lê
    await monitor.tick() // 3º: tick ímpar → NÃO lê
    await monitor.tick() // 4º: tick par → lê
    expect(readLive).toHaveBeenCalledTimes(3)
    expect(emitLive).toHaveBeenCalledTimes(3)
  })

  it('bypass suprime a leitura do preset ativo', async () => {
    const readLive = vi.fn(async () => LIVE_A)
    const { monitor } = makeMonitor(async () => status({ slotIndex: null, mode: null, bypass: true }), readLive)
    await monitor.tick(); await monitor.tick()
    expect(readLive).not.toHaveBeenCalled()
  })

  it('mismatch na verificação descarta a live e emite o status verificado', async () => {
    // 1ª leitura de status: slot X (0). Verificação (2ª leitura no MESMO tick): slot Y (1).
    let call = 0
    const readStatus = vi.fn(async () => (call++ === 0 ? status({ slotIndex: 0 }) : status({ slotIndex: 1 })))
    const readLive = vi.fn(async () => LIVE_A)
    const { monitor, emitStatus, emitLive } = makeMonitor(readStatus, readLive)
    await monitor.tick()
    expect(readLive).toHaveBeenCalledTimes(1)              // leu a live...
    expect(emitLive).not.toHaveBeenCalled()               // ...mas descartou a emissão
    expect(emitStatus).toHaveBeenCalledTimes(2)           // status inicial (X) + verificado (Y)
    expect(emitStatus).toHaveBeenLastCalledWith(status({ slotIndex: 1 }))
  })

  it('pause() durante uma leitura em voo suprime as emissões daquele tick', async () => {
    let resolveRead: (s: PedalStatus) => void = () => {}
    const readStatus = vi.fn(() => new Promise<PedalStatus>((r) => { resolveRead = r }))
    const emitStatus = vi.fn(); const emitLive = vi.fn()
    const monitor = new DeviceStateMonitor(readStatus, async () => LIVE_A, () => true, emitStatus, emitLive)
    const inflight = monitor.tick()  // fica em voo na leitura de status
    monitor.pause()                  // pausa chega ANTES de resolver
    resolveRead(status())            // resolve a leitura...
    await inflight                   // ...o guard pós-await deve bailar sem emitir
    expect(emitStatus).not.toHaveBeenCalled()
    expect(emitLive).not.toHaveBeenCalled()
  })

  it('tick pausado na entrada não emite (e zera o estado)', async () => {
    const { monitor, emitStatus } = makeMonitor(async () => status(), async () => null)
    await monitor.tick()
    monitor.pause(); await monitor.tick(); monitor.resume()
    await monitor.tick()
    expect(emitStatus).toHaveBeenCalledTimes(2) // tick pausado não conta
  })

  it('erro de leitura é silencioso e não emite', async () => {
    const { monitor, emitStatus } = makeMonitor(async () => { throw new Error('busy') }, async () => null)
    await expect(monitor.tick()).resolves.toBeUndefined()
    expect(emitStatus).not.toHaveBeenCalled()
  })

  it('desconexão na entrada não emite; reconexão volta a emitir', async () => {
    let connected = true
    const emitStatus = vi.fn()
    const monitor = new DeviceStateMonitor(
      async () => status(),
      async () => null,
      () => connected,
      emitStatus,
      vi.fn()
    )
    await monitor.tick()
    connected = false
    await monitor.tick()
    connected = true
    await monitor.tick()
    expect(emitStatus).toHaveBeenCalledTimes(2)
  })

  it('stop() seguido de start() com tick em voo não cria cadeia dupla de polling', async () => {
    vi.useFakeTimers()
    try {
      let resolveRead: (s: PedalStatus) => void = () => {}
      const readStatus = vi.fn(() => new Promise<PedalStatus>((r) => { resolveRead = r }))
      const emitStatus = vi.fn()
      const monitor = new DeviceStateMonitor(readStatus, async () => null, () => true, emitStatus, vi.fn())
      monitor.start()
      await vi.advanceTimersByTimeAsync(700)      // dispara o 1º tick, que fica em voo
      expect(readStatus).toHaveBeenCalledTimes(1)
      monitor.stop()                               // nada a limpar: timer já foi consumido
      monitor.start()                              // arma T1
      resolveRead(status())                        // tick em voo resolve; .finally NÃO deve armar T2
      await vi.advanceTimersByTimeAsync(700)       // apenas T1 dispara
      expect(readStatus).toHaveBeenCalledTimes(2)  // sem cadeia dupla (seria 3 com a corrida)
      monitor.stop()
      await vi.advanceTimersByTimeAsync(2100)
      expect(readStatus).toHaveBeenCalledTimes(2)  // stop() matou a única cadeia
    } finally {
      vi.useRealTimers()
    }
  })
})
