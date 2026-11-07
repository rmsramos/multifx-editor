import { describe, it, expect } from 'vitest'
import { decodeBlockParam, encodeBlockParam, blockAmountRange } from '@shared/block-param'

// Partição do byte 0-127 dos knobs-bloco (RVB DECAY, DLY MIX, MOD FX), derivada de:
// manual oficial (3 processos com zona morta entre eles), preset 2C de fábrica
// (byte 54 → display 11 no tipo 2) e display 40 do tipo 3 → byte 127.
// 0-39 = tipo 0 (display 1-40) | 40-42 morto | 43-83 = tipo 1 (0-40) | 84-86 morto | 87-127 = tipo 2 (0-40)

describe('block-param — knobs de 3 posições', () => {
  it('decodifica os limites de cada bloco', () => {
    expect(decodeBlockParam(0)).toEqual({ type: 0, amount: 1 })
    expect(decodeBlockParam(39)).toEqual({ type: 0, amount: 40 })
    expect(decodeBlockParam(40)).toEqual({ type: null, amount: 0 })
    expect(decodeBlockParam(42)).toEqual({ type: null, amount: 0 })
    expect(decodeBlockParam(43)).toEqual({ type: 1, amount: 0 })
    expect(decodeBlockParam(54)).toEqual({ type: 1, amount: 11 }) // preset 2C de fábrica ↔ M-EFCS
    expect(decodeBlockParam(83)).toEqual({ type: 1, amount: 40 })
    expect(decodeBlockParam(84)).toEqual({ type: null, amount: 0 })
    expect(decodeBlockParam(86)).toEqual({ type: null, amount: 0 })
    expect(decodeBlockParam(87)).toEqual({ type: 2, amount: 0 })
    expect(decodeBlockParam(127)).toEqual({ type: 2, amount: 40 }) // DLY MIX display 40 confirmado
  })

  it('codifica tipo+quantidade de volta para o byte', () => {
    expect(encodeBlockParam(0, 1)).toBe(0)
    expect(encodeBlockParam(0, 40)).toBe(39)
    expect(encodeBlockParam(1, 0)).toBe(43)
    expect(encodeBlockParam(1, 11)).toBe(54)
    expect(encodeBlockParam(2, 0)).toBe(87)
    expect(encodeBlockParam(2, 40)).toBe(127)
  })

  it('clampa quantidades fora do range do bloco', () => {
    expect(encodeBlockParam(0, 0)).toBe(0) // tipo 0 começa em 1
    expect(encodeBlockParam(0, 99)).toBe(39)
    expect(encodeBlockParam(2, 99)).toBe(127)
  })

  it('round-trip para todos os bytes fora das zonas mortas', () => {
    for (let byte = 0; byte <= 127; byte++) {
      const { type, amount } = decodeBlockParam(byte)
      if (type === null) continue
      expect(encodeBlockParam(type, amount)).toBe(byte)
    }
  })

  it('expõe o range de quantidade por bloco (tipo 0 inicia em 1)', () => {
    expect(blockAmountRange(0)).toEqual({ min: 1, max: 40 })
    expect(blockAmountRange(1)).toEqual({ min: 0, max: 40 })
    expect(blockAmountRange(2)).toEqual({ min: 0, max: 40 })
  })
})
