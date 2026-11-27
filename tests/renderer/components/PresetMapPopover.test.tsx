import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import PresetMapPopover from '@renderer/components/PresetMapPopover'
import { usePresetStore } from '@renderer/stores/preset-store'
import { useSettingsStore } from '@renderer/stores/settings-store'

describe('PresetMapPopover', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }))

  function setup(extra: Partial<React.ComponentProps<typeof PresetMapPopover>> = {}) {
    const anchor = document.createElement('button')
    document.body.appendChild(anchor)
    const anchorRef = createRef<HTMLElement>() as React.MutableRefObject<HTMLElement | null>
    anchorRef.current = anchor
    const props = {
      presets: usePresetStore.getState().presets,
      currentBank: 3,
      currentSlot: 'C' as const,
      dirtyIndices: new Set<number>(),
      pedalDirtyIndices: new Set<number>(),
      anchorRef,
      onSelect: vi.fn(),
      onClose: vi.fn(),
      ...extra,
    }
    render(<PresetMapPopover {...props} />)
    return { props, anchor }
  }

  it('mostra os 36 presets com o ativo marcado', () => {
    setup()
    expect(screen.getAllByRole('button', { name: /^Preset / })).toHaveLength(36)
    expect(screen.getByRole('button', { name: 'Preset 3C' })).toHaveAttribute('aria-current', 'true')
  })

  it('escolher um preset seleciona e fecha', () => {
    const { props } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Preset 5B' }))
    expect(props.onSelect).toHaveBeenCalledWith(5, 'B')
    expect(props.onClose).toHaveBeenCalled()
  })

  it('mantém os marcadores de modificado', () => {
    setup({ dirtyIndices: new Set([6, 7]), pedalDirtyIndices: new Set([6]) })
    expect(screen.getByRole('button', { name: 'Preset 2C (changed on the pedal)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preset 2D (modified)' })).toBeInTheDocument()
    expect(screen.getAllByTestId('dirty-pedal')).toHaveLength(1)
    expect(screen.getAllByTestId('dirty-ui')).toHaveLength(1)
  })

  it('Esc fecha', () => {
    const { props } = setup()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalled()
  })

  it('clique fora fecha, mas clique no botão que abre não', () => {
    const { props, anchor } = setup()
    fireEvent.pointerDown(anchor)
    expect(props.onClose).not.toHaveBeenCalled()
    fireEvent.pointerDown(document.body)
    expect(props.onClose).toHaveBeenCalled()
  })
})
