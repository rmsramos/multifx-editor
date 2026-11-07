import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PresetGrid from '@renderer/components/PresetGrid'

describe('PresetGrid', () => {
  const baseProps = {
    currentBank: 1,
    currentSlot: 'A' as const,
    dirtyIndices: new Set<number>(),
    onSelect: vi.fn(),
  }

  it('renderiza as 36 células', () => {
    render(<PresetGrid {...baseProps} />)
    expect(screen.getAllByRole('button')).toHaveLength(36)
    expect(screen.getByRole('button', { name: 'Preset 9D' })).toBeInTheDocument()
  })

  it('marca a célula ativa com aria-current', () => {
    render(<PresetGrid {...baseProps} currentBank={3} currentSlot="C" />)
    expect(screen.getByRole('button', { name: 'Preset 3C' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'Preset 1A' })).not.toHaveAttribute('aria-current', 'true')
  })

  it('mostra indicador de modificado na célula dirty', () => {
    render(<PresetGrid {...baseProps} dirtyIndices={new Set([6])} />) // 6 = 2C
    expect(screen.getByRole('button', { name: 'Preset 2C (modified)' })).toBeInTheDocument()
  })

  it('clique chama onSelect com bank e slot', () => {
    const onSelect = vi.fn()
    render(<PresetGrid {...baseProps} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Preset 5B' }))
    expect(onSelect).toHaveBeenCalledWith(5, 'B')
  })

  it('sujo vindo do pedal usa rótulo e marcador próprios', () => {
    render(<PresetGrid {...baseProps} dirtyIndices={new Set([6, 7])} pedalDirtyIndices={new Set([6])} />)
    expect(screen.getByRole('button', { name: 'Preset 2C (changed on the pedal)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preset 2D (modified)' })).toBeInTheDocument()
    expect(screen.getAllByTestId('dirty-pedal')).toHaveLength(1)
    expect(screen.getAllByTestId('dirty-ui')).toHaveLength(1)
  })

  it('anima o slot ativo só logo após troca feita no pedal', () => {
    const { rerender } = render(<PresetGrid {...baseProps} pedalSwitchAt={Date.now()} />)
    expect(screen.getByTestId('pedal-switch-ping')).toBeInTheDocument()
    rerender(<PresetGrid {...baseProps} pedalSwitchAt={Date.now() - 5000} />)
    expect(screen.queryByTestId('pedal-switch-ping')).toBeNull()
  })
})
