import { describe, it, expect } from 'vitest'
import type { Transport, DiscoveredDevice } from '../../../src/main/transport/transport'
import type { ConnectionStatus, DeviceInfo } from '../../../src/shared/types/device'

class MockTransport implements Transport {
  private status: ConnectionStatus = 'disconnected'
  private statusCallback?: (status: ConnectionStatus) => void

  async scan(timeout?: number): Promise<DiscoveredDevice[]> {
    return [{ id: 'aa:bb:cc:dd:ee:ff', name: 'TANK-G' }]
  }

  async connect(deviceId?: string): Promise<DeviceInfo> {
    this.status = 'connected'
    this.statusCallback?.('connected')
    return { id: deviceId ?? 'test', name: 'TANK-G' }
  }

  async disconnect(): Promise<void> {
    this.status = 'disconnected'
    this.statusCallback?.('disconnected')
  }

  getStatus(): ConnectionStatus { return this.status }

  onStatusChange(cb: (status: ConnectionStatus) => void): void {
    this.statusCallback = cb
  }

  async readAllPresets(): Promise<Uint8Array> {
    return new Uint8Array(756)
  }

}

describe('Transport interface', () => {
  it('should scan for devices', async () => {
    const transport = new MockTransport()
    const devices = await transport.scan!()
    expect(devices).toHaveLength(1)
    expect(devices[0].name).toBe('TANK-G')
  })

  it('should connect and update status', async () => {
    const transport = new MockTransport()
    let lastStatus: ConnectionStatus = 'disconnected'
    transport.onStatusChange((s) => { lastStatus = s })

    await transport.connect('aa:bb:cc:dd:ee:ff')
    expect(transport.getStatus()).toBe('connected')
    expect(lastStatus).toBe('connected')
  })

  it('should disconnect', async () => {
    const transport = new MockTransport()
    await transport.connect()
    await transport.disconnect()
    expect(transport.getStatus()).toBe('disconnected')
  })

  it('should read all presets (756 bytes)', async () => {
    const transport = new MockTransport()
    const data = await transport.readAllPresets()
    expect(data.length).toBe(756)
  })

})
