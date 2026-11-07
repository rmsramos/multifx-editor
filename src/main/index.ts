import { app, shell, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc/handlers'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { translate } from '../shared/i18n'
import type { Locale } from '../shared/i18n'
// Window icon for Linux docks and taskbars (packaged builds also get the .desktop icon from electron-builder).
import icon from '../../build/icon.png?asset'

let currentLocale: Locale = 'en'

ipcMain.on(IPC_CHANNELS.APP_SET_LOCALE, (_e, locale: Locale) => {
  currentLocale = locale
})

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1120,
    minHeight: 700,
    title: 'MultiFX Editor',
    icon,
    backgroundColor: '#0f1014',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('close', async (e) => {
    e.preventDefault()
    const hasUnsaved = await mainWindow.webContents.executeJavaScript(
      'window.tankGApi?.app?.hasUnsaved?.() ?? false'
    )
    if (hasUnsaved) {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: [translate(currentLocale, 'dialog.quitWithoutSaving'), translate(currentLocale, 'dialog.cancel')],
        defaultId: 1,
        title: translate(currentLocale, 'dialog.unsavedTitle'),
        message: translate(currentLocale, 'dialog.unsavedMessage'),
        detail: translate(currentLocale, 'dialog.unsavedDetail'),
      })
      if (response === 1) return // Cancelar
    }
    mainWindow.destroy()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  registerIpcHandlers(mainWindow)
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.multifxeditor.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
