import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const KEY = 'multifx.viewMode'

async function freshStore() {
  vi.resetModules()
  return (await import('@renderer/stores/settings-store')).useSettingsStore
}

describe('settings-store: viewMode', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('primeira abertura (nada salvo) começa no modo Painel', async () => {
    const store = await freshStore()
    expect(store.getState().viewMode).toBe('panel')
  })

  it('setViewMode grava a escolha no localStorage', async () => {
    const store = await freshStore()
    store.getState().setViewMode('rig')
    expect(store.getState().viewMode).toBe('rig')
    expect(localStorage.getItem(KEY)).toBe('rig')
  })

  it('reabre no último modo escolhido', async () => {
    localStorage.setItem(KEY, 'rig')
    const store = await freshStore()
    expect(store.getState().viewMode).toBe('rig')
  })

  it('valor inválido salvo cai no Painel', async () => {
    localStorage.setItem(KEY, 'xyz')
    const store = await freshStore()
    expect(store.getState().viewMode).toBe('panel')
  })

  it('localStorage indisponível cai no Painel sem quebrar', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const store = await freshStore()
    expect(store.getState().viewMode).toBe('panel')
    expect(() => store.getState().setViewMode('rig')).not.toThrow()
    expect(store.getState().viewMode).toBe('rig')
  })
})
