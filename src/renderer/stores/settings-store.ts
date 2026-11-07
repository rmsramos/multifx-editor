import { create } from 'zustand'
import type { Locale } from '@shared/i18n'

const STORAGE_KEY = 'multifx.locale'
function initialLocale(): Locale {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  return saved === 'pt-BR' || saved === 'en' ? saved : 'en' // padrão: inglês
}

interface SettingsStore {
  locale: Locale
  setLocale: (locale: Locale) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  locale: initialLocale(),
  setLocale: (locale) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, locale)
    set({ locale })
  },
}))
