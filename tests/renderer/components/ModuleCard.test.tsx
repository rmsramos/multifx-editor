import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModuleCard from '@renderer/components/ModuleCard'
import NoiseGateModule from '@renderer/components/NoiseGateModule'
import IrCabModule from '@renderer/components/IrCabModule'
import AmpModule from '@renderer/components/AmpModule'
import { MODULE_COLORS } from '@renderer/theme'

const STRIPE_OFF = '#262933'

const stripe = (container: HTMLElement): HTMLElement =>
  container.querySelector('[data-testid="module-stripe"]') as HTMLElement

describe('ModuleCard: faixa superior e bloqueio de interação', () => {
  it('módulo desabilitado torna o conteúdo inerte (nenhuma interação interna)', () => {
    const { container } = render(
      <ModuleCard title="X" color="#fbbf24" enabled={false} onToggle={() => {}}>
        <button>interno</button>
      </ModuleCard>
    )
    expect(screen.getByText('interno').closest('[inert]')).not.toBeNull()
  })

  it('módulo habilitado mantém o conteúdo interativo', () => {
    render(
      <ModuleCard title="X" color="#fbbf24" enabled={true} onToggle={() => {}}>
        <button>interno</button>
      </ModuleCard>
    )
    expect(screen.getByText('interno').closest('[inert]')).toBeNull()
  })

  it('accentOff apaga a faixa sem bloquear o conteúdo', () => {
    const { container } = render(
      <ModuleCard title="X" color="#fbbf24" accentOff>
        <button>interno</button>
      </ModuleCard>
    )
    expect(stripe(container)).toHaveStyle({ backgroundColor: STRIPE_OFF })
    expect(screen.getByText('interno').closest('[inert]')).toBeNull()
  })
})

describe('NoiseGateModule: faixa acompanha o threshold', () => {
  it('threshold 0 → faixa apagada', () => {
    const { container } = render(<NoiseGateModule value={0} onChange={() => {}} />)
    expect(stripe(container)).toHaveStyle({ backgroundColor: STRIPE_OFF })
  })

  it('threshold > 0 → faixa acesa', () => {
    const { container } = render(<NoiseGateModule value={11} onChange={() => {}} />)
    expect(stripe(container)).toHaveStyle({ backgroundColor: MODULE_COLORS.gate })
  })
})

describe('IrCabModule: faixa acompanha o slot', () => {
  it('Off (0) → faixa apagada, select continua acessível', () => {
    const { container } = render(<IrCabModule value={0} onChange={() => {}} />)
    expect(stripe(container)).toHaveStyle({ backgroundColor: STRIPE_OFF })
    expect(screen.getByRole('combobox').closest('[inert]')).toBeNull()
  })

  it('slot 8 → faixa acesa', () => {
    const { container } = render(<IrCabModule value={8} onChange={() => {}} />)
    expect(stripe(container)).toHaveStyle({ backgroundColor: MODULE_COLORS.irCab })
  })
})

describe('AmpModule desabilitado bloqueia o select de tipo', () => {
  const settings = {
    enabled: false, type: '1J120_CL · JC-120 Jazz Chorus' as const,
    gain: 64, treble: 64, middle: 64, bass: 64, volume: 64,
  }

  it('select do amp fica dentro de container inerte quando desabilitado', () => {
    render(<AmpModule settings={settings} onChange={() => {}} />)
    expect(screen.getByRole('combobox').closest('[inert]')).not.toBeNull()
  })

  it('select volta a ser interativo quando habilitado', () => {
    const onChange = vi.fn()
    render(<AmpModule settings={{ ...settings, enabled: true }} onChange={onChange} />)
    const select = screen.getByRole('combobox')
    expect(select.closest('[inert]')).toBeNull()
    fireEvent.change(select, { target: { value: '2J900_CL · JCM900 (clean)' } })
    expect(onChange).toHaveBeenCalled()
  })
})
