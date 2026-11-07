import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusBar from '@renderer/components/StatusBar'
import { version } from '../../../package.json'

describe('StatusBar', () => {
  const base = { currentBank: 1, currentSlot: 'A' as const, isDirty: false, isCurrentDirty: false }

  it('desconectado mostra a versão do package.json (nunca um número fixo)', () => {
    render(<StatusBar {...base} />)
    expect(screen.getByText(`MultiFX Editor v${version}`)).toBeInTheDocument()
  })

  it('conectado mostra a versão do app seguida de porta, modelo e firmware', () => {
    render(<StatusBar {...base} deviceInfo={{ id: 'hw:4,0,0', name: 'Tank G', model: 'TANK-Gv2', firmware: 96 }} />)
    expect(screen.getByText(`MultiFX Editor v${version} · hw:4,0,0 · TANK-Gv2 · firmware 96`)).toBeInTheDocument()
  })
})
