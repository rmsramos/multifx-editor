import type { DirtyKind } from '../presetMeta'
import { BRAND_COLOR } from '../theme'

interface DirtyDotProps {
  kind: DirtyKind
  className?: string
}

/** Marcador de preset modificado: cheio = editado na UI; vazado = diferença vinda do pedal. */
export default function DirtyDot({ kind, className = 'absolute top-0.5 right-0.5' }: DirtyDotProps) {
  return (
    <span
      data-testid={kind === 'pedal' ? 'dirty-pedal' : 'dirty-ui'}
      aria-hidden="true"
      className={`w-1.5 h-1.5 rounded-full border ${className}`}
      style={
        kind === 'pedal'
          ? { borderColor: BRAND_COLOR, backgroundColor: 'transparent' }
          : { borderColor: 'transparent', backgroundColor: BRAND_COLOR }
      }
    />
  )
}
