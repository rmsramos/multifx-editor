import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Knob from '@renderer/components/Knob'

describe('Knob', () => {
  it('deve renderizar com label e valor', () => {
    render(<Knob label="Gain" value={64} color="#f6ad55" onChange={vi.fn()} />)
    expect(screen.getByText('64')).toBeInTheDocument()
    expect(screen.getByText('Gain')).toBeInTheDocument()
  })

  it('deve exibir estado desabilitado', () => {
    render(<Knob label="Gain" value={64} color="#fbbf24" onChange={vi.fn()} disabled />)
    // valor segue legível (muted); só o arco/ponto apagam
    expect(screen.getByText('64')).toHaveAttribute('fill', '#8b8e98')
    expect(screen.getByText('Gain')).toHaveStyle({ color: '#6b6f7b' })
    expect(screen.getByRole('slider', { name: 'Gain' })).toHaveAttribute('tabindex', '-1')
  })

  it('scroll para cima incrementa em 3', () => {
    const onChange = vi.fn()
    render(<Knob label="Gain" value={64} color="#fbbf24" onChange={onChange} />)
    fireEvent.wheel(screen.getByTestId('knob-dial'), { deltaY: -100 })
    expect(onChange).toHaveBeenCalledWith(67)
  })

  it('Shift+scroll incrementa em 1 (ajuste fino)', () => {
    const onChange = vi.fn()
    render(<Knob label="Gain" value={64} color="#fbbf24" onChange={onChange} />)
    fireEvent.wheel(screen.getByTestId('knob-dial'), { deltaY: -100, shiftKey: true })
    expect(onChange).toHaveBeenCalledWith(65)
  })

  it('scroll não passa do máximo', () => {
    const onChange = vi.fn()
    render(<Knob label="Gain" value={126} color="#fbbf24" onChange={onChange} />)
    fireEvent.wheel(screen.getByTestId('knob-dial'), { deltaY: -100 })
    expect(onChange).toHaveBeenCalledWith(127)
  })

  it('duplo clique restaura o valor padrão (64)', () => {
    const onChange = vi.fn()
    render(<Knob label="Gain" value={100} color="#fbbf24" onChange={onChange} />)
    fireEvent.doubleClick(screen.getByTestId('knob-dial'))
    expect(onChange).toHaveBeenCalledWith(64)
  })

  it('desabilitado ignora scroll e duplo clique', () => {
    const onChange = vi.fn()
    render(<Knob label="Gain" value={64} color="#fbbf24" onChange={onChange} disabled />)
    fireEvent.wheel(screen.getByTestId('knob-dial'), { deltaY: -100 })
    fireEvent.doubleClick(screen.getByTestId('knob-dial'))
    expect(onChange).not.toHaveBeenCalled()
  })
})

// O M-EFCS 3.10 (2026-10) exibe o BYTE puro (Gain 99 = byte 99); o +1 era do app Qt antigo.
describe('Knob — teclado e ARIA', () => {
  it('expõe slider com valor, mínimo e máximo', () => {
    render(<Knob label="Gain" value={79} color="#f6ad55" onChange={vi.fn()} />)
    const s = screen.getByRole('slider', { name: 'Gain' })
    expect(s).toHaveAttribute('aria-valuenow', '79')
    expect(s).toHaveAttribute('aria-valuemin', '0')
    expect(s).toHaveAttribute('aria-valuemax', '127')
    expect(screen.getByText('79')).toBeInTheDocument()
  })

  it('setas ajustam ±1, PageUp ±13, Home/End vão aos extremos', () => {
    const onChange = vi.fn()
    render(<Knob label="Gain" value={64} color="#f6ad55" onChange={onChange} />)
    const s = screen.getByRole('slider', { name: 'Gain' })
    fireEvent.keyDown(s, { key: 'ArrowUp' })
    fireEvent.keyDown(s, { key: 'ArrowDown' })
    fireEvent.keyDown(s, { key: 'PageUp' })
    fireEvent.keyDown(s, { key: 'Home' })
    fireEvent.keyDown(s, { key: 'End' })
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([65, 63, 77, 0, 127])
  })

  it('não chama onChange quando já está no limite', () => {
    const onChange = vi.fn()
    render(<Knob label="Gain" value={127} color="#f6ad55" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Gain' }), { key: 'ArrowUp' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('arrasto com ponteiro: subir 10 px soma ~13 (127/100 por px)', () => {
    const onChange = vi.fn()
    render(<Knob label="Gain" value={64} color="#f6ad55" onChange={onChange} />)
    const dial = screen.getByTestId('knob-dial')
    fireEvent.pointerDown(dial, { button: 0, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(dial, { clientY: 90, pointerId: 1 })
    fireEvent.pointerUp(dial, { pointerId: 1 })
    fireEvent.pointerMove(dial, { clientY: 50, pointerId: 1 })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(77)
  })
})
