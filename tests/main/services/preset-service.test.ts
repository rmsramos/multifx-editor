import { describe, it, expect, vi } from 'vitest'
import { PresetService } from '../../../src/main/services/preset-service'
import { createDefaultPreset, encodeAllPresets, PRESET_BYTE_LENGTH } from '../../../src/main/protocol/preset-codec'
import type { Transport } from '../../../src/main/transport/transport'
import type { ConnectionStatus, DeviceInfo, DiscoveredDevice } from '../../../src/shared/types/device'

function createMockTransport(presetData?: Uint8Array): Transport {
  return {
    connect: vi.fn(async () => ({ id: 'test', name: 'TANK-G' })),
    disconnect: vi.fn(async () => {}),
    getStatus: vi.fn(() => 'connected' as ConnectionStatus),
    onStatusChange: vi.fn(),
    readAllPresets: vi.fn(async () => presetData ?? new Uint8Array(36 * PRESET_BYTE_LENGTH)),
    selectPreset: vi.fn(async () => {}),
  }
}

describe('PresetService', () => {
  it('should create a valid default preset', () => {
    const service = new PresetService(createMockTransport())
    const preset = createDefaultPreset(1, 'A')
    expect(preset.bank).toBe(1)
    expect(preset.slot).toBe('A')
    expect(service.validate(preset)).toBe(true)
  })

  it('should validate preset fields', () => {
    const service = new PresetService(createMockTransport())
    const preset = createDefaultPreset(1, 'A')
    expect(service.validate(preset)).toBe(true)

    preset.bank = 0
    expect(service.validate(preset)).toBe(false)

    preset.bank = 1
    preset.amp.gain = 200
    expect(service.validate(preset)).toBe(false)
  })

  it('should export and import JSON', () => {
    const service = new PresetService(createMockTransport())
    const original = createDefaultPreset(3, 'B')
    original.amp.gain = 100

    const json = service.exportToJson(original)
    const imported = service.importFromJson(json)
    expect(imported.amp.gain).toBe(100)
    expect(imported.bank).toBe(3)
  })

  it('should read all presets from transport', async () => {
    const defaults = Array.from({ length: 36 }, (_, i) =>
      createDefaultPreset(Math.floor(i / 4) + 1, (['A', 'B', 'C', 'D'] as const)[i % 4])
    )
    const encoded = encodeAllPresets(defaults)
    const transport = createMockTransport(encoded)
    const service = new PresetService(transport)

    const presets = await service.readAll()
    expect(presets).toHaveLength(36)
    expect(presets[0].bank).toBe(1)
    expect(presets[0].slot).toBe('A')
    expect(presets[35].bank).toBe(9)
    expect(presets[35].slot).toBe('D')
    expect(transport.readAllPresets).toHaveBeenCalledOnce()
  })

  it('should reject invalid JSON on import', () => {
    const service = new PresetService(createMockTransport())
    expect(() => service.importFromJson('not json')).toThrow()
  })
})
