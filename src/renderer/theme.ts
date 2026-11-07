// Cores por módulo — única fonte para componentes (espelha os tokens do globals.css).
// Paleta segue os LEDs dos knobs do PEDAL: gate=branco, amp=vermelho, mod=verde,
// delay=azul, reverb=lilás, ir cab=laranja (fotos do hardware, 2026-06-12).
export const MODULE_COLORS = {
  gate: '#f8fafc',
  amp: '#ef4444',
  mod: '#4ade80',
  delay: '#3b82f6',
  reverb: '#a78bfa',
  irCab: '#fb923c',
} as const

// Âmbar da marca (wordmark do app) — independente da cor do módulo AMP.
export const BRAND_COLOR = '#fbbf24'
export const KNOB_DEFAULT = 64
