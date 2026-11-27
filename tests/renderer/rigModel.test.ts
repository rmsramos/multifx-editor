import { describe, it, expect } from 'vitest'
import { rigBlocks } from '@renderer/rigModel'
import { usePresetStore } from '@renderer/stores/preset-store'
import { AMP_TYPES } from '@shared/constants'
import type { Preset } from '@shared/types/preset'

const base = (): Preset => structuredClone(usePresetStore.getState().presets[0])

const byKey = (p: Preset) => Object.fromEntries(rigBlocks(p).map((b) => [b.key, b]))

describe('rigBlocks', () => {
  it('ordem fixa do Tank-G', () => {
    expect(rigBlocks(base()).map((b) => b.key)).toEqual(['gate', 'amp', 'mod', 'delay', 'reverb', 'cab'])
  })

  it('knob-bloco na zona morta: OFF e apagado, mesmo com enabled', () => {
    const p = { ...base(), delay: { enabled: true, time: 10, mix: 41 } }
    const d = byKey(p).delay
    expect(d.active).toBe(false)
    expect(d.enabled).toBe(true)
    expect(d.typeLabel).toBe('OFF')
    expect(d.knobs[1]).toEqual({ value: 0, min: 0, max: 40 })
  })

  it('tipo e quantidade decodificados do byte (reverb decay 50 = Spring 7)', () => {
    const p = { ...base(), reverb: { enabled: true, mix: 30, decay: 50 } }
    const r = byKey(p).reverb
    expect(r.typeLabel).toBe('SPRING')
    expect(r.knobs).toEqual([{ value: 30, min: 0, max: 127 }, { value: 7, min: 0, max: 40 }])
    expect(r.active).toBe(true)
  })

  it('cab 0 = Off e apagado; gate 0 apagado; amp mostra o código do modelo', () => {
    const p = { ...base(), irCab: 0, noiseGate: 0, amp: { ...base().amp, type: AMP_TYPES[3], enabled: true } }
    const b = byKey(p)
    expect(b.cab.active).toBe(false)
    expect(b.cab.typeLabel).toBe('Off')
    expect(b.cab.knobs).toEqual([])
    expect(b.gate.active).toBe(false)
    expect(b.gate.toggleable).toBe(false)
    expect(b.amp.typeLabel).toBe('4RAT_OD')
    expect(b.amp.knobs).toHaveLength(5)
    expect(b.amp.toggleable).toBe(true)
  })

  it('amp desligado fica apagado', () => {
    const p = { ...base(), amp: { ...base().amp, enabled: false } }
    expect(byKey(p).amp.active).toBe(false)
  })
})
