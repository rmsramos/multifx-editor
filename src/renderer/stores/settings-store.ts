import { create } from 'zustand'
import type { Locale } from '@shared/i18n'

/** Painel = cards de módulo (padrão); Rig = pedaleira + painel de detalhe. */
export type ViewMode = 'panel' | 'rig'

const LOCALE_KEY = 'multifx.locale'
const VIEW_MODE_KEY = 'multifx.viewMode'

// localStorage pode estar ausente (testes) ou bloqueado: a preferência é só conveniência,
// nunca pode quebrar a abertura do app.
function readPref(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null
  } catch {
    return null
  }
}

function writePref(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value)
  } catch {
    // sem persistência: a escolha vale só nesta sessão
  }
}

function initialLocale(): Locale {
  const saved = readPref(LOCALE_KEY)
  return saved === 'pt-BR' || saved === 'en' ? saved : 'en' // padrão: inglês
}

function initialViewMode(): ViewMode {
  return readPref(VIEW_MODE_KEY) === 'rig' ? 'rig' : 'panel' // primeira abertura: Painel
}

interface SettingsStore {
  locale: Locale
  setLocale: (locale: Locale) => void
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  locale: initialLocale(),
  setLocale: (locale) => {
    writePref(LOCALE_KEY, locale)
    set({ locale })
  },
  viewMode: initialViewMode(),
  setViewMode: (viewMode) => {
    writePref(VIEW_MODE_KEY, viewMode)
    set({ viewMode })
  },
}))
