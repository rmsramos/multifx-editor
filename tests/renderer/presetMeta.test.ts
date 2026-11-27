import { describe, it, expect } from 'vitest'
import { presetIndex, ampCode, ampName, cabCode, dirtyKind, outsideBankDirty } from '@renderer/presetMeta'

describe('presetMeta', () => {
  it('presetIndex segue banco × slot', () => {
    expect(presetIndex(1, 'A')).toBe(0)
    expect(presetIndex(2, 'C')).toBe(6)
    expect(presetIndex(9, 'D')).toBe(35)
  })

  it('separa código e nome do amp', () => {
    expect(ampCode('4RAT_OD · Pro Co RAT')).toBe('4RAT_OD')
    expect(ampName('4RAT_OD · Pro Co RAT')).toBe('Pro Co RAT')
  })

  it('código curto do IR (0 = Off)', () => {
    expect(cabCode(0)).toBe('Off')
    expect(cabCode(3)).toBe('3MESA_412')
  })

  it('dirtyKind distingue edição na UI de diferença vinda do pedal', () => {
    expect(dirtyKind(6, new Set([6]), new Set())).toBe('ui')
    expect(dirtyKind(6, new Set([6]), new Set([6]))).toBe('pedal')
    expect(dirtyKind(7, new Set([6]), new Set())).toBeNull()
  })

  it('outsideBankDirty olha só os bancos fora do exibido; UI vence pedal', () => {
    expect(outsideBankDirty(9, new Set([6]), new Set([6]))).toBe('pedal')
    expect(outsideBankDirty(9, new Set([6, 7]), new Set([6]))).toBe('ui')
    expect(outsideBankDirty(2, new Set([6]), new Set())).toBeNull()
  })
})
