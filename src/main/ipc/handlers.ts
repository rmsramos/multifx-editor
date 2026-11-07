import { ipcMain, dialog } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { AlsaMidiTransport } from '../transport/alsa-midi-transport'
import { PresetService } from '../services/preset-service'
import { ParamWriteQueue } from '../services/param-write-queue'
import type { Preset } from '../../shared/types/preset'
import { DeviceStateMonitor } from '../services/device-state-monitor'
import { liveBytesToPreset } from '../protocol/mvave-codec'
import { PRESET_SLOTS } from '../../shared/constants'
import type { SystemMode } from '../../shared/types/device'
import fs from 'fs/promises'

// Transporte: USB-MIDI via ALSA (validado contra o hardware em 2026-06-10).
let transport: AlsaMidiTransport
let presetService: PresetService
let writeQueue: ParamWriteQueue
let stateMonitor: DeviceStateMonitor

export function registerIpcHandlers(mainWindow: Electron.BrowserWindow): void {
  transport = new AlsaMidiTransport()
  writeQueue = new ParamWriteQueue((addr, value) => transport.writeParam(addr, value))
  stateMonitor = new DeviceStateMonitor(
    () => transport.readStatus(),
    () => transport.readActivePreset(),
    () => transport.getStatus() === 'connected',
    (status) => {
      if (!mainWindow.isDestroyed()) mainWindow.webContents.send(IPC_CHANNELS.PEDAL_STATE_CHANGED, status)
    },
    (live, status) => {
      if (mainWindow.isDestroyed() || status.slotIndex === null) return
      const preset = liveBytesToPreset(live, status.bankIndex + 1, PRESET_SLOTS[status.slotIndex])
      mainWindow.webContents.send(IPC_CHANNELS.PRESET_LIVE_CHANGED, preset)
    }
  )
  stateMonitor.start()
  // Para o polling ao fechar a janela — evita send() em janela destruída e timer pendente.
  mainWindow.on('closed', () => stateMonitor.stop())
  writeQueue.onStateChange((state) => {
    if (state === 'applying') stateMonitor.pause()
    else stateMonitor.resume()
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send(IPC_CHANNELS.SYNC_STATE_CHANGED, state)
  })
  transport.onStatusChange((status) => {
    // Ao (re)conectar, o buffer do pedal é desconhecido — próximo apply escreve tudo.
    if (status === 'connected') writeQueue.invalidate()
    console.log(`[device] status: ${status}`)
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send(IPC_CHANNELS.DEVICE_STATUS_CHANGED, status)
  })
  presetService = new PresetService(transport)

  // Diagnóstico do ciclo de conexão: o scan roda a cada 4s (sonda do renderer),
  // então só logamos quando o resultado muda — aparição/sumiço do pedal na porta.
  let lastScanIds = ''
  ipcMain.handle(IPC_CHANNELS.DEVICE_SCAN, async () => {
    const devices = await transport.scan()
    const ids = devices.map((d) => d.id).join(',')
    if (ids !== lastScanIds) {
      console.log(`[device] portas MIDI: ${ids || '(nenhuma)'}`)
      lastScanIds = ids
    }
    return devices
  })

  ipcMain.handle(IPC_CHANNELS.DEVICE_CONNECT, async (_event, deviceId?: string) => {
    console.log(`[device] conectando em ${deviceId ?? '(auto)'}...`)
    try {
      const info = await transport.connect(deviceId)
      console.log(`[device] conectado: ${info.id}`)
      return info
    } catch (error) {
      console.error(`[device] falha ao conectar: ${(error as Error).message}`)
      throw error
    }
  })

  ipcMain.handle(IPC_CHANNELS.DEVICE_DISCONNECT, async () => transport.disconnect())

  ipcMain.handle(IPC_CHANNELS.DEVICE_STATUS, () => transport.getStatus())
  ipcMain.handle(IPC_CHANNELS.DEVICE_INFO, () => transport.getInfo())

  ipcMain.handle(IPC_CHANNELS.PRESET_READ_ALL, async () => presetService.readAll())

  ipcMain.handle(IPC_CHANNELS.PRESET_APPLY_LIVE, (_event, preset: Preset) => {
    writeQueue.enqueuePreset(preset)
  })

  ipcMain.handle(IPC_CHANNELS.PRESET_SELECT, async (_event, index: number) => {
    // O PC carrega o preset da flash — o último estado aplicado deixa de valer.
    writeQueue.invalidate()
    await transport.selectPreset(index)
  })

  ipcMain.handle(IPC_CHANNELS.PRESET_SAVE, async (_event, index: number, preset: Preset) => {
    stateMonitor.pause()
    try {
      return await transport.savePreset(index, preset)
    } finally {
      stateMonitor.resume()
    }
  })

  ipcMain.handle(IPC_CHANNELS.TUNER_SET, async (_event, target: SystemMode) => {
    stateMonitor.pause()
    try {
      return await transport.setSystemMode(target)
    } finally {
      stateMonitor.resume()
    }
  })

  ipcMain.handle(IPC_CHANNELS.BYPASS_SET, async (_event, on: boolean, index: number) =>
    transport.setBypass(on, index)
  )

  ipcMain.handle(IPC_CHANNELS.SYNC_RETRY, async () => writeQueue.retry())

  ipcMain.handle(IPC_CHANNELS.PRESET_EXPORT, async (_event, preset: Preset) => {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `multifx-preset-${preset.bank}${preset.slot}.json`,
      filters: [{ name: 'MultiFX Preset', extensions: ['json'] }],
    })
    if (filePath) await fs.writeFile(filePath, presetService.exportToJson(preset), 'utf-8')
  })

  ipcMain.handle(IPC_CHANNELS.PRESET_IMPORT, async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: 'MultiFX Preset', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (filePaths.length > 0) {
      const json = await fs.readFile(filePaths[0], 'utf-8')
      return presetService.importFromJson(json)
    }
    return null
  })
}
