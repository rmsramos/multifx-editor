import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RigView from '@renderer/components/rig/RigView'
import { usePresetStore } from '@renderer/stores/preset-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import type { Preset } from '@shared/types/preset'

const presetAt = (i: number): Preset => structuredClone(usePresetStore.getState().presets[i])

const handlers = () => ({
  onUpdatePreset: vi.fn(),
  onUpdateAmp: vi.fn(),
  onUpdateMod: vi.fn(),
  onUpdateDelay: vi.fn(),
  onUpdateReverb: vi.fn(),
})

describe('RigView', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }))

  it('abre com o detalhe do Amp', () => {
    const p = { ...presetAt(0), amp: { ...presetAt(0).amp, enabled: true } }
    render(<RigView preset={p} {...handlers()} />)
    expect(screen.getByRole('button', { name: 'Edit Amp' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('combobox')).toHaveValue(p.amp.type)
    expect(screen.getByRole('slider', { name: 'Gain' })).toBeInTheDocument()
  })

  it('seleção do bloco persiste ao trocar de preset', () => {
    const h = handlers()
    const { rerender } = render(<RigView preset={presetAt(0)} {...h} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Reverb' }))
    expect(screen.getByRole('radio', { name: 'Spring' })).toBeInTheDocument()
    rerender(<RigView preset={presetAt(5)} {...h} />)
    expect(screen.getByRole('button', { name: 'Edit Reverb' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('radio', { name: 'Room' })).toBeInTheDocument()
  })

  it('detalhe do Cab explica que não há knobs', () => {
    render(<RigView preset={presetAt(0)} {...handlers()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Cab' }))
    expect(screen.getByText('The cabinet has no knobs, only the IR choice.')).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: /^(On|Off)$/ })).toBeNull()
  })

  it('footswitch e botão do detalhe alternam o enable pelo updater do bloco', () => {
    const h = handlers()
    const p = { ...presetAt(0), mod: { enabled: false, speed: 3, fx: 10 } }
    render(<RigView preset={p} {...h} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Turn Mod on or off' }))
    expect(h.onUpdateMod).toHaveBeenCalledWith({ enabled: true, speed: 3, fx: 10 })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Mod' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Off' }))
    expect(h.onUpdateMod).toHaveBeenCalledTimes(2)
  })
})
