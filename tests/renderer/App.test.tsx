import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { usePresetStore } from '@renderer/stores/preset-store'
import { useSettingsStore } from '@renderer/stores/settings-store'

const selectPreset = vi.fn()
let bypass = false

vi.mock('@renderer/hooks/useDevice', () => ({ useDevice: () => ({ connectionStatus: 'connected' }) }))
vi.mock('@renderer/hooks/usePreset', () => ({
  usePreset: () => ({
    currentPreset: usePresetStore.getState().presets[0],
    currentBank: 1,
    currentSlot: 'A',
    isDirty: false,
    isCurrentDirty: false,
    bypass,
    updatePreset: vi.fn(),
    updateAmp: vi.fn(),
    updateMod: vi.fn(),
    updateDelay: vi.fn(),
    updateReverb: vi.fn(),
    toggleBypass: vi.fn(),
    selectPreset,
    saveToDevice: vi.fn(),
    discardEdits: vi.fn(),
    importPreset: vi.fn(),
    exportPreset: vi.fn(),
    systemMode: 'normal',
    toggleTuner: vi.fn(),
    tunerPending: false,
  }),
}))

import App from '@renderer/App'

describe('App: modos Painel e Rig', () => {
  beforeEach(() => {
    bypass = false
    selectPreset.mockClear()
    useSettingsStore.setState({ locale: 'en', viewMode: 'panel' })
    ;(window as any).tankGApi = { app: { setLocale: vi.fn() }, sync: { retry: vi.fn(() => Promise.resolve()) } }
  })

  it('modo Painel mostra os cards e não a pedaleira', () => {
    render(<App />)
    expect(screen.getByText('Noise Gate')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Gate' })).toBeNull()
  })

  it('modo Rig mostra a pedaleira e não os cards', () => {
    useSettingsStore.setState({ viewMode: 'rig' })
    render(<App />)
    expect(screen.getByRole('button', { name: 'Edit Gate' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Signal chain' })).toBeNull()
  })

  it('o seletor do topo troca de modo na hora', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Rig' }))
    expect(screen.getByRole('button', { name: 'Edit Amp' })).toBeInTheDocument()
  })

  it.each(['panel', 'rig'] as const)('com bypass (%s) o editor trava, mas a faixa de presets segue clicável', (mode) => {
    bypass = true
    useSettingsStore.setState({ viewMode: mode })
    const { container } = render(<App />)
    expect(container.querySelector('[aria-disabled="true"]')).not.toBeNull()
    const chip = screen.getByRole('button', { name: 'Preset 1B' })
    expect(chip).toBeEnabled()
    fireEvent.click(chip)
    expect(selectPreset).toHaveBeenCalledWith(1, 'B')
  })

  it.each(['panel', 'rig'] as const)('avisos legais aparecem no modo %s', (mode) => {
    useSettingsStore.setState({ viewMode: mode })
    render(<App />)
    expect(screen.getByText(/not affiliated/i)).toBeInTheDocument()
  })
})
