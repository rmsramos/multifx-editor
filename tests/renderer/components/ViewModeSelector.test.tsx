import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ViewModeSelector from '@renderer/components/ViewModeSelector'
import { useSettingsStore } from '@renderer/stores/settings-store'

describe('ViewModeSelector', () => {
  beforeEach(() => useSettingsStore.setState({ viewMode: 'panel', locale: 'en' }))

  it('mostra Painel e Rig com o ativo marcado', () => {
    render(<ViewModeSelector />)
    expect(screen.getByRole('group', { name: 'View' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Panel' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Rig' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicar em Rig troca o modo', () => {
    render(<ViewModeSelector />)
    fireEvent.click(screen.getByRole('button', { name: 'Rig' }))
    expect(useSettingsStore.getState().viewMode).toBe('rig')
    expect(screen.getByRole('button', { name: 'Rig' })).toHaveAttribute('aria-pressed', 'true')
  })
})
