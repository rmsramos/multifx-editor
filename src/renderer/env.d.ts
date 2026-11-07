import type { TankGApi } from '../preload/index'

declare global {
  /** Versão do app (package.json), injetada pelo Vite no build. */
  const __APP_VERSION__: string
  interface Window {
    tankGApi: TankGApi
  }
}
