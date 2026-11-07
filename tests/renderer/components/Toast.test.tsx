import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Toast from '@renderer/components/Toast'
import { usePresetStore } from '@renderer/stores/preset-store'

describe('Toast', () => {
  beforeEach(() => {
    usePresetStore.setState({ toastMessage: null, toastVariant: 'error' })
  })

  it('não renderiza nada sem mensagem', () => {
    const { container } = render(<Toast />)
    expect(container).toBeEmptyDOMElement()
  })

  it('toast de erro mostra prefixo Error', () => {
    usePresetStore.getState().showToast('Falha ao salvar no pedal')
    render(<Toast />)
    expect(screen.getByRole('alert')).toHaveTextContent('Error')
    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao salvar no pedal')
  })

  it('toast de sucesso mostra prefixo OK, sem Error', () => {
    usePresetStore.getState().showToast('Preset 1A salvo no pedal', 'success')
    render(<Toast />)
    expect(screen.getByRole('status')).toHaveTextContent('OK')
    expect(screen.getByRole('status')).toHaveTextContent('Preset 1A salvo no pedal')
    expect(screen.queryByText('Error')).not.toBeInTheDocument()
  })

  it('variante volta a erro quando showToast é chamado sem variante', () => {
    usePresetStore.getState().showToast('Preset 1A salvo no pedal', 'success')
    usePresetStore.getState().showToast('Falha ao trocar preset no pedal')
    render(<Toast />)
    expect(screen.getByRole('alert')).toHaveTextContent('Error')
  })
})
