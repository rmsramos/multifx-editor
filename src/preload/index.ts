import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import type {
  ConnectionStatus,
  DeviceInfo,
  DiscoveredDevice,
  PedalStatus,
  SyncState,
  SystemMode,
} from '../shared/types/device'
import type { Preset, PresetSlot } from '../shared/types/preset'
import type { Locale } from '../shared/i18n'

let unsavedChecker: (() => boolean) | null = null

const api = {
  app: {
    hasUnsaved: (): boolean => unsavedChecker?.() ?? false,
    onCheckUnsaved: (checker: () => boolean): void => {
      unsavedChecker = checker
    },
    setLocale: (locale: Locale): void => ipcRenderer.send(IPC_CHANNELS.APP_SET_LOCALE, locale),
  },
  device: {
    scan: (): Promise<DiscoveredDevice[]> => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_SCAN),
    connect: (deviceId?: string): Promise<DeviceInfo> =>
      ipcRenderer.invoke(IPC_CHANNELS.DEVICE_CONNECT, deviceId),
    disconnect: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_DISCONNECT),
    getStatus: (): Promise<ConnectionStatus> => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_STATUS),
    getInfo: (): Promise<DeviceInfo | null> => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_INFO),
    onStatusChanged: (callback: (status: ConnectionStatus) => void) => {
      const listener = (_event: any, status: ConnectionStatus) => callback(status)
      ipcRenderer.on(IPC_CHANNELS.DEVICE_STATUS_CHANGED, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.DEVICE_STATUS_CHANGED, listener)
    },
    onPedalStateChanged: (callback: (status: PedalStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: PedalStatus) => callback(status)
      ipcRenderer.on(IPC_CHANNELS.PEDAL_STATE_CHANGED, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.PEDAL_STATE_CHANGED, listener)
    },
  },
  preset: {
    readAll: (): Promise<Preset[]> => ipcRenderer.invoke(IPC_CHANNELS.PRESET_READ_ALL),
    applyLive: (preset: Preset): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.PRESET_APPLY_LIVE, preset),
    select: (index: number): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.PRESET_SELECT, index),
    save: (index: number, preset: Preset): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.PRESET_SAVE, index, preset),
    importFile: (): Promise<Preset | null> => ipcRenderer.invoke(IPC_CHANNELS.PRESET_IMPORT),
    exportFile: (preset: Preset): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.PRESET_EXPORT, preset),
    onLiveChanged: (callback: (preset: Preset) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, preset: Preset) => callback(preset)
      ipcRenderer.on(IPC_CHANNELS.PRESET_LIVE_CHANGED, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.PRESET_LIVE_CHANGED, listener)
    },
  },
  sync: {
    retry: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.SYNC_RETRY),
    onStateChanged: (callback: (state: SyncState) => void) => {
      const listener = (_event: any, state: SyncState) => callback(state)
      ipcRenderer.on(IPC_CHANNELS.SYNC_STATE_CHANGED, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.SYNC_STATE_CHANGED, listener)
    },
  },
  tuner: {
    set: (target: SystemMode): Promise<SystemMode> =>
      ipcRenderer.invoke(IPC_CHANNELS.TUNER_SET, target),
  },
  bypass: {
    set: (on: boolean, index: number): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.BYPASS_SET, on, index),
  },
}

export type TankGApi = typeof api

contextBridge.exposeInMainWorld('tankGApi', api)
