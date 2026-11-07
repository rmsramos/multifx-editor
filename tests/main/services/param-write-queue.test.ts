import { describe, it, expect, vi } from 'vitest'
import { ParamWriteQueue } from '../../../src/main/services/param-write-queue'
import { PRESET_PARAM_ADDRESSES } from '../../../src/main/protocol/mvave-codec'
import type { Preset } from '../../../src/shared/types/preset'
import type { SyncState } from '../../../src/shared/types/device'

function makePreset(overrides: Partial<Preset> = {}): Preset {
  return {
    bank: 1, slot: 'A',
    noiseGate: 10,
    amp: { enabled: true, type: '1J120_CL · JC-120 Jazz Chorus', gain: 64, treble: 64, middle: 64, bass: 64, volume: 64 },
    mod: { enabled: false, speed: 30, fx: 5 },
    delay: { enabled: false, time: 40, mix: 20 },
    reverb: { enabled: true, mix: 50, decay: 18 },
    irCab: 1,
    color: { r: 0, g: 0, b: 255 },
    ...overrides,
  }
}

/** writer que resolve imediatamente e registra as chamadas */
function instantWriter() {
  const calls: Array<[number, number]> = []
  const writeParam = vi.fn(async (addr: number, value: number) => {
    calls.push([addr, value])
  })
  return { writeParam, calls }
}

/** writer que só resolve quando release() é chamado — para testar coalescing */
function manualWriter() {
  const calls: Array<[number, number]> = []
  const resolvers: Array<() => void> = []
  const writeParam = vi.fn((addr: number, value: number) => {
    calls.push([addr, value])
    return new Promise<void>((res) => resolvers.push(res))
  })
  return { writeParam, calls, release: () => resolvers.shift()?.() }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('ParamWriteQueue', () => {
  it('primeira aplicação escreve todos os addrs de parâmetro, em ordem', async () => {
    const { writeParam, calls } = instantWriter()
    const queue = new ParamWriteQueue(writeParam)
    queue.enqueuePreset(makePreset())
    await flush()
    expect(calls.map(([a]) => a)).toEqual([...PRESET_PARAM_ADDRESSES])
  })

  it('aplicação seguinte escreve só os bytes que mudaram', async () => {
    const { writeParam, calls } = instantWriter()
    const queue = new ParamWriteQueue(writeParam)
    const p = makePreset()
    queue.enqueuePreset(p)
    await flush()
    calls.length = 0
    queue.enqueuePreset(makePreset({ amp: { ...p.amp, gain: 90 } }))
    await flush()
    expect(calls).toEqual([[0x06, 90]]) // addr 6 = gain
  })

  it('coalesce: valores obsoletos do mesmo addr são descartados', async () => {
    const { writeParam, calls, release } = manualWriter()
    const queue = new ParamWriteQueue(writeParam)
    const p = makePreset()
    queue.enqueuePreset(p) // começa a drenar; 1ª escrita fica pendurada
    queue.enqueuePreset(makePreset({ amp: { ...p.amp, gain: 80 } }))
    queue.enqueuePreset(makePreset({ amp: { ...p.amp, gain: 99 } }))
    for (let i = 0; i < 30; i++) { release(); await flush() }
    const gainWrites = calls.filter(([a]) => a === 0x06)
    expect(gainWrites).toEqual([[0x06, 64], [0x06, 99]]) // o 80 nunca foi escrito
  })

  it('emite applying durante o drain e synced ao terminar', async () => {
    const { writeParam } = instantWriter()
    const queue = new ParamWriteQueue(writeParam)
    const states: SyncState[] = []
    queue.onStateChange((s) => states.push(s))
    queue.enqueuePreset(makePreset())
    await flush()
    expect(states).toEqual(['applying', 'synced'])
  })

  it('falha de escrita → estado error; retry() reescreve e volta a synced', async () => {
    let fail = true
    const calls: Array<[number, number]> = []
    const writeParam = vi.fn(async (addr: number, value: number) => {
      if (fail) throw new Error('Sem ACK')
      calls.push([addr, value])
    })
    const queue = new ParamWriteQueue(writeParam)
    queue.enqueuePreset(makePreset())
    await flush()
    expect(queue.getState()).toBe('error')
    fail = false
    await queue.retry()
    expect(queue.getState()).toBe('synced')
    expect(calls.map(([a]) => a)).toEqual([...PRESET_PARAM_ADDRESSES]) // nada se perdeu
  })

  it('invalidate() força reescrita completa no próximo enqueue', async () => {
    const { writeParam, calls } = instantWriter()
    const queue = new ParamWriteQueue(writeParam)
    queue.enqueuePreset(makePreset())
    await flush()
    calls.length = 0
    queue.invalidate()
    queue.enqueuePreset(makePreset())
    await flush()
    expect(calls.length).toBe(PRESET_PARAM_ADDRESSES.length)
  })
})

describe('regressões de bugs latentes', () => {
  it('Bug1: preset enqueued em estado error não é sobrescrito por pendingPreset stale', async () => {
    // Writer customizado: 1ª escrita fica pendurada; na sequência, uma falha; depois instant
    let failOnce = false
    let resolveImmediate = false
    const calls: Array<[number, number]> = []
    const resolvers: Array<() => void> = []

    const writeParam = vi.fn((addr: number, value: number) => {
      calls.push([addr, value])
      if (failOnce) {
        failOnce = false
        return Promise.reject(new Error('fail'))
      }
      if (resolveImmediate) return Promise.resolve()
      return new Promise<void>((res) => resolvers.push(res))
    })
    const release = () => resolvers.shift()?.()
    const queue = new ParamWriteQueue(writeParam)
    const base = makePreset() // gain=64

    // (a) Inicia drain — primeira escrita fica pendurada
    queue.enqueuePreset(base)
    await flush()

    // (b) Durante drain: enqueue gain=80 → vai para pendingPreset
    queue.enqueuePreset(makePreset({ amp: { ...base.amp, gain: 80 } }))

    // (c) Libera 1ª escrita com sucesso; 2ª falha → estado error; pendingPreset=80 fica retido
    failOnce = true
    release()
    await flush()
    expect(queue.getState()).toBe('error')

    // (d) Usuário edita gain=99 enquanto em error; escritas já succedem imediatamente
    resolveImmediate = true
    queue.enqueuePreset(makePreset({ amp: { ...base.amp, gain: 99 } }))
    await flush()

    // A última escrita do gain deve ser 99 — pendingPreset stale (80) não pode ser replayed
    const gainWrites = calls.filter(([a]) => a === 0x06)
    expect(gainWrites.at(-1)).toEqual([0x06, 99])
  })

  it('Bug2: invalidate() durante drain parcial não corrompe lastApplied — força reescrita completa', async () => {
    // Primeiras 2 escritas completam antes do invalidate; 3ª fica pendurada;
    // invalidate() é chamado enquanto a 3ª escrita ainda está pendente.
    // Sem a correção, lastApplied fica parcialmente zerado: addrs escritos antes do
    // invalidate ficam com 0, fazendo enqueuePreset pular params cujo valor real é 0.
    let autoComplete = 2  // primeiras 2 escritas resolvem imediatamente
    let resolveImmediate = false
    const calls: Array<[number, number]> = []
    const resolvers: Array<() => void> = []

    const writeParam = vi.fn((addr: number, value: number) => {
      calls.push([addr, value])
      if (resolveImmediate) return Promise.resolve()
      if (autoComplete > 0) {
        autoComplete--
        return Promise.resolve()
      }
      return new Promise<void>((res) => resolvers.push(res))
    })
    const release = () => resolvers.shift()?.()
    const queue = new ParamWriteQueue(writeParam)

    // (a) Inicia drain: 2 primeiras escritas (addr 0x00=reverb.enabled=1, 0x01=mod.enabled=0)
    //     completam; 3ª (addr 0x02=delay.enabled=0) fica pendurada
    queue.enqueuePreset(makePreset())
    await flush()

    // (b) Invalida enquanto drain ainda está em progresso (addr[2] pendente)
    queue.invalidate()

    // (c) Conclui o drain (restante instant)
    resolveImmediate = true
    release()
    await flush()
    expect(queue.getState()).toBe('synced')

    // (d) Enqueue o mesmo preset novamente — deve escrever TODOS os 18 addrs,
    //     inclusive addr 0x01 (mod.enabled=false → byte 0) que foi "aplicado" antes do invalidate
    const prevCount = calls.length
    queue.enqueuePreset(makePreset())
    await flush()

    const newCalls = calls.slice(prevCount)
    expect(newCalls.map(([a]) => a)).toEqual([...PRESET_PARAM_ADDRESSES])
  })
})
