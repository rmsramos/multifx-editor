import { useEffect } from 'react'
import { usePresetStore } from '../stores/preset-store'
import { useTranslation } from '../i18n'

export default function Toast() {
  const message = usePresetStore((s) => s.toastMessage)
  const variant = usePresetStore((s) => s.toastVariant)
  const clearToast = usePresetStore((s) => s.clearToast)
  const { t } = useTranslation()

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(clearToast, 5000)
    return () => clearTimeout(timer)
  }, [message, clearToast])

  if (!message) return null

  const isError = variant === 'error'

  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`fixed bottom-10 right-4 z-50 px-4 py-2.5 rounded-lg bg-tank-raised border text-xs text-tank-text shadow-lg cursor-pointer transition-[opacity,translate] duration-200 ease-out starting:opacity-0 starting:translate-y-2 ${
        isError ? 'border-tank-err' : 'border-tank-ok'
      }`}
      onClick={clearToast}
    >
      <span className={`font-semibold mr-2 ${isError ? 'text-tank-err' : 'text-tank-ok'}`}>
        {t(isError ? 'toast.errorTag' : 'toast.okTag')}
      </span>
      {message}
    </div>
  )
}
