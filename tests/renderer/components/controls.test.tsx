import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { encodeBlockParam } from '@shared/block-param'
import { AMP_TYPES } from '@shared/constants'
import AmpControls from '@renderer/components/controls/AmpControls'
import ModControls from '@renderer/components/controls/ModControls'
import DelayControls from '@renderer/components/controls/DelayControls'
import IrCabControls from '@renderer/components/controls/IrCabControls'

describe('controles dos blocos (compartilhados por Painel e Rig)', () => {
  it('ModControls na zona morta: nenhum tipo marcado e quantidade desabilitada', () => {
    render(<ModControls settings={{ enabled: true, speed: 10, fx: 41 }} onChange={vi.fn()} />)
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    radios.forEach((r) => expect(r).toHaveAttribute('aria-checked', 'false'))
    expect(screen.getByRole('slider', { name: 'FX' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('DelayControls: trocar o tipo preserva a quantidade', () => {
    const onChange = vi.fn()
    render(<DelayControls settings={{ enabled: true, time: 30, mix: 10 }} onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Tape' }))
    expect(onChange).toHaveBeenCalledWith({ enabled: true, time: 30, mix: encodeBlockParam(1, 11) })
  })

  it('AmpControls com o amp desligado: modelo e knobs desabilitados', () => {
    const settings = { enabled: false, type: AMP_TYPES[3], gain: 1, treble: 2, middle: 3, bass: 4, volume: 5 }
    render(<AmpControls settings={settings} onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(screen.getByRole('slider', { name: 'Gain' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('IrCabControls: escolher outro IR chama onChange com o índice', () => {
    const onChange = vi.fn()
    render(<IrCabControls value={1} onChange={onChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '3' } })
    expect(onChange).toHaveBeenCalledWith(3)
  })
})
