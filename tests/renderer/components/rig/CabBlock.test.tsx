import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import CabBlock from '@renderer/components/rig/CabBlock'
import type { RigBlock } from '@renderer/rigModel'

const block = (active: boolean): RigBlock => ({
  key: 'cab', color: '#fb923c', active, toggleable: false, enabled: true, typeLabel: active ? '3MESA_412' : 'Off', knobs: [],
})

describe('CabBlock', () => {
  it('desenha um cone por alto-falante do IR (4x12 = 4)', () => {
    const { getAllByTestId } = render(<CabBlock block={block(true)} cones={4} selectLabel="Edit Cab" selected={false} onSelect={vi.fn()} />)
    expect(getAllByTestId('cab-cone')).toHaveLength(4)
  })

  it('sem seleção não tem contorno na cor do bloco (não pode parecer selecionado)', () => {
    const { getByRole } = render(<CabBlock block={block(true)} cones={4} selectLabel="Edit Cab" selected={false} onSelect={vi.fn()} />)
    const body = getByRole('button', { name: 'Edit Cab' })
    expect(body.style.borderColor).toBe('')
    expect(body.style.outlineColor).toBe('')
    expect(body.className).not.toMatch(/(^|\s)outline-tank-warn(\s|$)/)
  })

  it('estrutura pintada na cor do bloco, como os pedais (ligado não pode parecer apagado)', () => {
    const { getByRole } = render(<CabBlock block={block(true)} cones={4} selectLabel="Edit Cab" selected={false} onSelect={vi.fn()} />)
    const body = getByRole('button', { name: 'Edit Cab' })
    expect(body.style.backgroundColor).toBe('rgb(251, 146, 60)') // #fb923c
    expect(body).toHaveAttribute('data-active', 'true')
  })

  it('com o IR desligado continua parecendo um gabinete (2 cones apagados)', () => {
    const { getAllByTestId } = render(<CabBlock block={block(false)} cones={0} selectLabel="Edit Cab" selected={false} onSelect={vi.fn()} />)
    expect(getAllByTestId('cab-cone')).toHaveLength(2)
  })
})
