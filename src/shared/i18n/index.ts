import { en } from './en'
import { ptBR } from './pt-BR'

export type Locale = 'en' | 'pt-BR'
export type MessageKey = keyof typeof en
export const LOCALES: Locale[] = ['en', 'pt-BR']
export const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', 'pt-BR': 'PT' }

const messages: Record<Locale, Record<MessageKey, string>> = { en, 'pt-BR': ptBR }

/** Traduz `key` no `locale`, interpolando {param} com params. Cai no inglês se faltar. */
export function translate(locale: Locale, key: MessageKey, params?: Record<string, string | number>): string {
  const template = messages[locale]?.[key] ?? messages.en[key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`))
}
