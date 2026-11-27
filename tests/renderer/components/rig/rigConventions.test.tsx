import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import { render, screen } from '@testing-library/react'
import RigBoard from '@renderer/components/rig/RigBoard'
import { usePresetStore } from '@renderer/stores/preset-store'
import { useSettingsStore } from '@renderer/stores/settings-store'

const RIG_DIR = path.resolve(__dirname, '../../../../src/renderer/components/rig')

describe('convenções do modo Rig', () => {
  beforeEach(() => useSettingsStore.setState({ locale: 'en' }))

  it('nenhuma cor solta: só tokens (globals.css) e MODULE_COLORS/BRAND_COLOR', () => {
    const offenders = readdirSync(RIG_DIR)
      .filter((f) => /\.(tsx?|css)$/.test(f))
      .flatMap((f) =>
        readFileSync(path.join(RIG_DIR, f), 'utf8')
          .split('\n')
          .filter((line) => /#[0-9a-fA-F]{3,8}\b/.test(line))
          .map((line) => `${f}: ${line.trim()}`),
      )
    expect(offenders).toEqual([])
  })

  it('blocos não selecionados mantêm o anel de foco do teclado', () => {
    render(<RigBoard preset={usePresetStore.getState().presets[0]} selected="amp" onSelect={vi.fn()} onToggle={vi.fn()} />)
    for (const name of ['Edit Gate', 'Edit Mod', 'Edit Cab', 'Edit Amp']) {
      const cls = screen.getByRole('button', { name }).className
      expect(cls).not.toMatch(/(^|\s)outline-none(\s|$)/)
      expect(cls).toMatch(/focus-visible:outline-tank-focus/)
    }
  })
})
