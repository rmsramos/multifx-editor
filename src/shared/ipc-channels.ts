export const IPC_CHANNELS = {
  DEVICE_SCAN: 'device:scan',
  DEVICE_CONNECT: 'device:connect',
  DEVICE_DISCONNECT: 'device:disconnect',
  DEVICE_STATUS: 'device:status',
  DEVICE_INFO: 'device:info',
  DEVICE_STATUS_CHANGED: 'device:status-changed',
  PEDAL_STATE_CHANGED: 'device:pedal-state-changed',
  PRESET_READ_ALL: 'preset:read-all',
  PRESET_IMPORT: 'preset:import',
  PRESET_EXPORT: 'preset:export',
  PRESET_APPLY_LIVE: 'preset:apply-live',
  PRESET_LIVE_CHANGED: 'preset:live-changed',
  PRESET_SELECT: 'preset:select',
  PRESET_SAVE: 'preset:save',
  SYNC_STATE_CHANGED: 'sync:state-changed',
  SYNC_RETRY: 'sync:retry',
  TUNER_SET: 'tuner:set',
  BYPASS_SET: 'bypass:set',
  APP_SET_LOCALE: 'app:set-locale',
} as const

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS]
