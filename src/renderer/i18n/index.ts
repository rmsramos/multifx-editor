import { useCallback } from 'react'
import { translate, type MessageKey, type Locale } from '@shared/i18n'
import { useSettingsStore } from '../stores/settings-store'

/** Hook para uso em render: reage à troca de idioma. */
export function useTranslation() {
  const locale = useSettingsStore((s) => s.locale)
  const setLocale = useSettingsStore((s) => s.setLocale)
  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale]
  )
  return { t, locale, setLocale }
}

/** Tradução imperativa (callbacks/toasts fora do render): lê o locale no momento da chamada. */
export function tr(key: MessageKey, params?: Record<string, string | number>): string {
  return translate(useSettingsStore.getState().locale, key, params)
}
