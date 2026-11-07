import { useTranslation } from '../i18n'

interface EditorLockProps {
  mode: 'bypass' | 'tuner'
  /** Navegação do afinador em andamento (~1-2 s): o botão espera. */
  pending?: boolean
  onExit: () => void
}

/** Aviso sobre o editor travado: diz por que a edição está pausada e oferece a saída. */
export default function EditorLock({ mode, pending = false, onExit }: EditorLockProps) {
  const { t } = useTranslation()
  return (
    <div className="absolute inset-0 flex items-start justify-center pt-24 pointer-events-none">
      <div
        role="status"
        className="pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-lg border border-tank-border bg-tank-raised px-6 py-5 text-center shadow-xl transition-[opacity,translate] duration-200 ease-out starting:opacity-0 starting:translate-y-1"
      >
        <p className="text-sm text-tank-text">{t(mode === 'tuner' ? 'lock.tuner' : 'lock.bypass')}</p>
        <button
          onClick={onExit}
          disabled={pending}
          aria-busy={pending}
          className="px-3 py-1.5 text-xs font-semibold rounded-md border border-tank-border bg-tank-card text-tank-text hover:border-tank-muted cursor-pointer disabled:cursor-wait disabled:opacity-60"
        >
          {t(mode === 'tuner' ? 'lock.tunerAction' : 'lock.bypassAction')}
        </button>
      </div>
    </div>
  )
}
