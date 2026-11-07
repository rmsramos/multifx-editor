import type { ConnectionStatus, DeviceInfo, DiscoveredDevice, PedalStatus } from '../../shared/types/device'
import type { Preset } from '../../shared/types/preset'

export type { DiscoveredDevice }

export interface Transport {
  scan?(timeout?: number): Promise<DiscoveredDevice[]>
  connect(deviceId?: string): Promise<DeviceInfo>
  disconnect(): Promise<void>
  getStatus(): ConnectionStatus
  onStatusChange(callback: (status: ConnectionStatus) => void): void
  readAllPresets(): Promise<Uint8Array>
  /** Seleciona o preset ativo via Program Change (índice 0-35). Opcional por transporte. */
  selectPreset?(index: number): Promise<void>
  /** Grava o preset no slot da flash (persiste após desligar). Opcional. */
  savePreset?(index: number, preset: Preset): Promise<void>
  /** Liga/desliga o bypass do preset `index` (0-35). Opcional por transporte. */
  setBypass?(on: boolean, index: number): Promise<void>
  /** Lê o status do pedal (banco/slot/modo/bypass). Opcional por transporte. */
  readStatus?(): Promise<PedalStatus>
  /** Lê o preset ativo (21 bytes live-order) ou null (sem resposta / bypass). Opcional por transporte. */
  readActivePreset?(): Promise<Uint8Array | null>
}
