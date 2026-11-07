import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EditorToolbar from '../../src/renderer/components/EditorToolbar'

const baseProps = {
  presetLabel: '1A',
  ledColor: { r: 255, g: 0, b: 0 },
  onLedColorChange: vi.fn(),
  bypass: false,
  onBypassToggle: () => {},
  connectionStatus: 'connected' as const,
  syncState: 'synced' as const,
  onRetry: () => {},
  onSave: () => {},
  onDiscard: vi.fn(),
  isCurrentDirty: false,
  tunerActive: false,
  tunerPending: false,
  onTunerToggle: vi.fn(),
}

describe('EditorToolbar — Afinador', () => {
  it('chama onTunerToggle ao clicar no switch', () => {
    const onTunerToggle = vi.fn()
    render(<EditorToolbar {...baseProps} onTunerToggle={onTunerToggle} />)
    fireEvent.click(screen.getByRole('switch', { name: /tuner/i }))
    expect(onTunerToggle).toHaveBeenCalledOnce()
  })

  it('marca o switch como ativo quando tunerActive', () => {
    render(<EditorToolbar {...baseProps} tunerActive />)
    expect(screen.getByRole('switch', { name: /tuner/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('desabilita o switch quando desconectado', () => {
    render(<EditorToolbar {...baseProps} connectionStatus="disconnected" />)
    expect(screen.getByRole('switch', { name: /tuner/i })).toBeDisabled()
  })

  it('marca aria-busy quando a navegação está pendente', () => {
    render(<EditorToolbar {...baseProps} tunerPending />)
    expect(screen.getByRole('switch', { name: /tuner/i })).toHaveAttribute('aria-busy', 'true')
  })
})

describe('EditorToolbar — Descartar', () => {
  it('não mostra o botão quando o preset não está modificado', () => {
    render(<EditorToolbar {...baseProps} isCurrentDirty={false} />)
    expect(screen.queryByRole('button', { name: /discard/i })).toBeNull()
  })

  it('mostra o botão e chama onDiscard quando modificado', () => {
    const onDiscard = vi.fn()
    render(<EditorToolbar {...baseProps} isCurrentDirty onDiscard={onDiscard} />)
    fireEvent.click(screen.getByRole('button', { name: /discard/i }))
    expect(onDiscard).toHaveBeenCalledOnce()
  })

  it('desabilita o botão quando desconectado', () => {
    render(<EditorToolbar {...baseProps} isCurrentDirty connectionStatus="disconnected" />)
    expect(screen.getByRole('button', { name: /discard/i })).toBeDisabled()
  })
})

describe('EditorToolbar — Bypass', () => {
  it('chama onBypassToggle ao clicar no switch', () => {
    const onBypassToggle = vi.fn()
    render(<EditorToolbar {...baseProps} onBypassToggle={onBypassToggle} />)
    fireEvent.click(screen.getByRole('switch', { name: /bypass/i }))
    expect(onBypassToggle).toHaveBeenCalledOnce()
  })

  it('desabilita o switch de bypass quando desconectado', () => {
    render(<EditorToolbar {...baseProps} connectionStatus="disconnected" />)
    expect(screen.getByRole('switch', { name: /bypass/i })).toBeDisabled()
  })
})

describe('EditorToolbar — título do preset', () => {
  it('mostra o rótulo do preset em edição como título', () => {
    render(<EditorToolbar {...baseProps} presetLabel="7C" />)
    expect(screen.getByRole('heading', { name: 'Preset 7C' })).toHaveTextContent('7C')
  })

  it('desabilita a cor do LED com bypass ativo', () => {
    render(<EditorToolbar {...baseProps} bypass />)
    expect(screen.getByRole('button', { name: /LED color of the preset/ })).toBeDisabled()
  })
})
