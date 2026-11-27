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

  it('com o IR desligado continua parecendo um gabinete (2 cones apagados)', () => {
    const { getAllByTestId } = render(<CabBlock block={block(false)} cones={0} selectLabel="Edit Cab" selected={false} onSelect={vi.fn()} />)
    expect(getAllByTestId('cab-cone')).toHaveLength(2)
  })
})
