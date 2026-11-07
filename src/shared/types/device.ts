export type ConnectionStatus = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'error'

export interface DeviceInfo {
  serialNumber?: string
  id: string
  name: string
  /** Modelo reportado pelo pedal no discovery (ex.: "TANK-Gv2"). */
  model?: string
  /** Versão do firmware reportada no discovery (ex.: 96). */
  firmware?: number
}

export interface DiscoveredDevice {
  id: string
  name: string
}

/**
 * Estado da fila de escrita ao vivo (main → renderer via sync:state-changed).
 * - 'synced': fila vazia, última escrita confirmada (ACK)
 * - 'applying': fila drenando — há escritas a caminho do pedal
 * - 'error': uma escrita falhou; pendentes ficam retidos até retry()
 */
export type SyncState = 'synced' | 'applying' | 'error'

/** Modo de sistema do pedal (funções do footswitch B+C). Lido na região SysEx 0x42. */
export type SystemMode = 'normal' | 'live' | 'tuner'

/** Status do pedal lido na região 0x42 (decodificado em hardware 2026-07-05). */
export interface PedalStatus {
  /** 0-8 = bancos 1-9. Válido mesmo durante bypass. */
  bankIndex: number
  /** 0-3 = slots A-D. `null` durante bypass (padrão 7C 0F sobrepõe o campo). */
  slotIndex: number | null
  /** `null` durante bypass. */
  mode: SystemMode | null
  bypass: boolean
}
