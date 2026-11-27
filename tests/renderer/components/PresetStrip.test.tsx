import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PresetStrip from '@renderer/components/PresetStrip'
import { usePresetStore } from '@renderer/stores/preset-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { AMP_TYPES } from '@shared/constants'
import type { Preset } from '@shared/types/preset'

function presetsWithAmps(): Preset[] {
  return usePresetStore.getState().presets.map((p, i) => ({ ...p, amp: { ...p.amp, type: AMP_TYPES[i % 9] } }))
}

describe('PresetStrip', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }))

  const props = () => ({
    presets: presetsWithAmps(),
    currentBank: 9,
    currentSlot: 'B' as const,
    dirtyIndices: new Set<number>(),
    pedalDirtyIndices: new Set<number>(),
    pedalSwitchAt: 0,
    onSelect: vi.fn(),
    onImport: vi.fn(),
    onExport: vi.fn(),
  })

  it('mostra os 4 presets do banco ativo, com o ativo marcado e o código do amp', () => {
    render(<PresetStrip {...props()} />)
    for (const s of ['A', 'B', 'C', 'D']) expect(screen.getByRole('button', { name: `Preset 9${s}` })).toBeInTheDocument()
    const active = screen.getByRole('button', { name: 'Preset 9B' })
    expect(active).toHaveAttribute('aria-current', 'true')
    // índice 33 = 9B → AMP_TYPES[33 % 9] = AMP_TYPES[6]
    expect(active).toHaveTextContent('7MS_GV2')
  })

  it('setas só navegam (circular) e não trocam o preset do pedal', () => {
    const p = props()
    render(<PresetStrip {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next bank' }))
    expect(screen.getByRole('button', { name: 'Preset 1A' })).toBeInTheDocument()
    expect(p.onSelect).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { current: true })).toBeNull()
    expect(screen.getByText('Active: 9B')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Previous bank' }))
    expect(screen.getByRole('button', { name: 'Preset 9B' })).toHaveAttribute('aria-current', 'true')
  })

  it('clicar num chip seleciona o preset', () => {
    const p = props()
    render(<PresetStrip {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next bank' }))
    fireEvent.click(screen.getByRole('button', { name: 'Preset 1C' }))
    expect(p.onSelect).toHaveBeenCalledWith(1, 'C')
  })

  it('pula para o banco ativo quando o preset muda', () => {
    const p = props()
    const { rerender } = render(<PresetStrip {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next bank' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next bank' }))
    expect(screen.getByRole('button', { name: 'Preset 2A' })).toBeInTheDocument()
    rerender(<PresetStrip {...p} currentBank={5} currentSlot="A" pedalSwitchAt={Date.now()} />)
    expect(screen.getByRole('button', { name: 'Preset 5A' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByTestId('pedal-switch-ping')).toBeInTheDocument()
  })

  it('marca presets modificados no chip', () => {
    render(<PresetStrip {...props()} dirtyIndices={new Set([33, 34])} pedalDirtyIndices={new Set([34])} />)
    expect(screen.getByRole('button', { name: 'Preset 9B (modified)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preset 9C (changed on the pedal)' })).toBeInTheDocument()
  })

  it('avisa no "All presets" quando há modificados em outros bancos', () => {
    render(<PresetStrip {...props()} dirtyIndices={new Set([6])} pedalDirtyIndices={new Set([6])} />)
    const all = screen.getByRole('button', { name: /All presets/ })
    expect(all).toHaveAttribute('title', 'Presets modified in other banks')
    expect(all.querySelector('[data-testid="dirty-pedal"]')).not.toBeNull()
  })

  it('"All presets" abre o mapa e Import/Export chamam os callbacks', () => {
    const p = props()
    render(<PresetStrip {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /All presets/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    expect(p.onImport).toHaveBeenCalled()
    expect(p.onExport).toHaveBeenCalled()
  })
})
