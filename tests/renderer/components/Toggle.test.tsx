import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Toggle from '@renderer/components/Toggle'

describe('Toggle', () => {
  it('deve renderizar estado habilitado com cor de fundo', () => {
    render(<Toggle enabled={true} color="#f6ad55" onToggle={vi.fn()} />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(toggle).toHaveStyle({ backgroundColor: '#f6ad55' })
  })

  it('deve renderizar estado desabilitado com fundo escuro', () => {
    render(<Toggle enabled={false} color="#f6ad55" onToggle={vi.fn()} />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(toggle).toHaveStyle({ backgroundColor: '#262933' })
  })

  it('deve chamar onToggle ao clicar', async () => {
    const onToggle = vi.fn()
    render(<Toggle enabled={false} color="#f6ad55" onToggle={onToggle} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('switch'))
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
