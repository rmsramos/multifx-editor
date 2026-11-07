import { describe, it, expect } from 'vitest'
import { AMP_TYPES, IR_CAB_SLOTS } from '@shared/constants'

// AMP TYPE = byte 5 (0-8) → 9 tipos. IR CAB = byte 17 (índice 0-8) → 9 slots.
// MOD/DELAY/REVERB não têm seletor de tipo no preset (o "tipo" é codificado nos
// bytes MOD FX / DLY MIX / RVB DECAY em blocos de 1-40). Ver docs/protocol/usb-sysex.md.
describe('constants', () => {
  it('deve ter 9 tipos de AMP', () => {
    expect(AMP_TYPES).toHaveLength(9)
  })
  it('deve ter 9 slots de IR CAB (Off + 8 cabs, ids 0-8)', () => {
    expect(IR_CAB_SLOTS).toHaveLength(9)
    expect(IR_CAB_SLOTS[0]).toEqual({ id: 0, name: 'Off', size: '' })
    expect(IR_CAB_SLOTS[8].id).toBe(8)
  })
})
