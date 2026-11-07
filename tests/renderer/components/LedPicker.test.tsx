import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LedPicker from '@renderer/components/LedPicker'

describe('LedPicker', () => {
  const color = { r: 0, g: 0, b: 255 }
  const open = () => fireEvent.click(screen.getByRole('button', { name: /LED color of the preset: #0000FF/ }))

  it('botão mostra o hex da cor atual no rótulo e começa fechado', () => {
    render(<LedPicker color={color} onChange={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /#0000FF/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('clique em um swatch chama onChange com o RGB do swatch', () => {
    const onChange = vi.fn()
    render(<LedPicker color={color} onChange={onChange} />)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'LED Red' }))
    expect(onChange).toHaveBeenCalledWith({ r: 255, g: 0, b: 0 })
  })

  it('input de cor personalizada chama onChange com o RGB escolhido', () => {
    const onChange = vi.fn()
    render(<LedPicker color={color} onChange={onChange} />)
    open()
    fireEvent.change(screen.getByLabelText('Pick LED color'), { target: { value: '#ff7f00' } })
    expect(onChange).toHaveBeenCalledWith({ r: 255, g: 127, b: 0 })
  })

  it('Escape e clique fora fecham o painel', () => {
    render(<LedPicker color={color} onChange={vi.fn()} />)
    open()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    open()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('marca o swatch branco mesmo após a ida e volta em 7 bits (#FCFCFC)', () => {
    render(<LedPicker color={{ r: 252, g: 252, b: 252 }} onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /#FCFCFC/ }))
    expect(screen.getByRole('button', { name: 'LED White' })).toHaveAttribute('aria-pressed', 'true')
  })
})
