import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RigBoard from '@renderer/components/rig/RigBoard'
import { usePresetStore } from '@renderer/stores/preset-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import type { Preset } from '@shared/types/preset'

const preset = (): Preset => ({
  ...structuredClone(usePresetStore.getState().presets[0]),
  noiseGate: 40,
  irCab: 2,
  amp: { ...usePresetStore.getState().presets[0].amp, enabled: true },
  mod: { enabled: true, speed: 20, fx: 10 },
  delay: { enabled: true, time: 30, mix: 41 }, // zona morta
  reverb: { enabled: false, mix: 30, decay: 50 },
})

describe('RigBoard', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }))

  it('6 blocos selecionáveis e 4 footswitches', () => {
    render(<RigBoard preset={preset()} selected="amp" onSelect={vi.fn()} onToggle={vi.fn()} />)
    for (const n of ['Gate', 'Amp', 'Mod', 'Delay', 'Reverb', 'Cab']) {
      expect(screen.getByRole('button', { name: `Edit ${n}` })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('switch')).toHaveLength(4)
    expect(screen.queryByRole('switch', { name: 'Turn Gate on or off' })).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Turn Cab on or off' })).toBeNull()
  })

  it('footswitch alterna o efeito sem mudar a seleção', () => {
    const onSelect = vi.fn()
    const onToggle = vi.fn()
    render(<RigBoard preset={preset()} selected="amp" onSelect={onSelect} onToggle={onToggle} />)
    const fs = screen.getByRole('switch', { name: 'Turn Mod on or off' })
    expect(fs).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(fs)
    expect(onToggle).toHaveBeenCalledWith('mod')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('clicar no corpo seleciona; o selecionado fica marcado', () => {
    const onSelect = vi.fn()
    render(<RigBoard preset={preset()} selected="amp" onSelect={onSelect} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Edit Amp' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Edit Reverb' }))
    expect(onSelect).toHaveBeenCalledWith('reverb')
  })

  it('desligado e zona morta aparecem apagados; zona morta mostra OFF', () => {
    render(<RigBoard preset={preset()} selected="amp" onSelect={vi.fn()} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Edit Reverb' })).toHaveAttribute('data-active', 'false')
    expect(screen.getByRole('switch', { name: 'Turn Reverb on or off' })).toHaveAttribute('aria-checked', 'false')
    const delay = screen.getByRole('button', { name: 'Edit Delay' })
    expect(delay).toHaveAttribute('data-active', 'false')
    expect(delay).toHaveTextContent('OFF')
    expect(screen.getByRole('switch', { name: 'Turn Delay on or off' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'Edit Mod' })).toHaveAttribute('data-active', 'true')
  })
})
