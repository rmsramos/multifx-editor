import { LOCALES, LOCALE_LABELS, type Locale } from '@shared/i18n'
import { useTranslation } from '../i18n'

const ARIA_LABELS: Record<Locale, string> = {
  en: 'Switch to English',
  'pt-BR': 'Mudar para Português',
}

export default function LanguageSelector() {
  const { locale, setLocale } = useTranslation()

  return (
    <div className="flex items-center gap-0.5 rounded bg-tank-raised border border-tank-border p-0.5">
      {LOCALES.map((l) => {
        const active = l === locale
        return (
          <button
            key={l}
            onClick={() => setLocale(l)}
            aria-pressed={active}
            aria-label={ARIA_LABELS[l]}
            className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
              active ? 'bg-tank-card text-tank-text' : 'text-tank-muted hover:text-tank-text'
            }`}
          >
            {LOCALE_LABELS[l]}
          </button>
        )
      })}
    </div>
  )
}
