import type { AmpType } from './types/preset'

// AMP TYPE = byte 5 do preset (0-8) = slot 1-9 da tabela AMP do MANUAL OFICIAL
// (TANK-G_en.pdf, baixado com o firmware v96; nomes confirmados nos binários oficiais).
// Formato: "<código do manual> · <amp emulado>". O código já embute o nº do slot.
export const AMP_TYPES = [
  '1J120_CL · JC-120 Jazz Chorus',   // 1 — Clean · Roland JC-120
  '2J900_CL · JCM900 (clean)',       // 2 — Clean · Marshall JCM900
  '3VAVE_TS · ODRIVE-TS',            // 3 — Overdrive · M-VAVE ODRIVE-TS
  '4RAT_OD · Pro Co RAT',            // 4 — Overdrive · Pro Co RAT
  '5VAVE_HTS · ODRIVE-TS (hi-gain)', // 5 — Distortion · M-VAVE ODRIVE-TS
  '6VAVE_DS · M-VAVE MT1',           // 6 — Distortion · M-VAVE MT1
  "7MS_GV2 · GV-2 Guv'nor Plus",     // 7 — Distortion · Marshall GV-2 Guv'nor Plus
  '8J900_HV · JCM900 (hi-gain)',     // 8 — Distortion · Marshall JCM900
  '9MS_HIGAIN · BB-2 Bluesbreaker',  // 9 — Distortion · Marshall BB-2 Blues breaker
] as const

// IR CAB = byte 17 do preset, índice 0-8 = slot da tabela CAB do MANUAL OFICIAL
// (TANK-G_en.pdf). name = "<código do manual> · <cabinet emulado>"; size = configuração.
export const IR_CAB_SLOTS = [
  { id: 0, name: 'Off', size: '' },
  { id: 1, name: '1AC-SeVin · AC-SE210', size: '2x10' },
  { id: 2, name: '2JVM_1960_57 · JVM410 1960', size: '4x12' },
  { id: 3, name: '3MESA_412 · Mesa Boogie', size: '4x12' },
  { id: 4, name: '4WANGS112 · WANGS112 G12', size: '1x12' },
  { id: 5, name: '5VOX_AC30 · VOX AC30', size: '2x12' },
  { id: 6, name: '6HIFI_YAMAHA · Yamaha HiFi', size: '2x10' },
  { id: 7, name: '7EGNL_412 · ENGL 412', size: '4x12' },
  { id: 8, name: '8V30_MD421 · Celestion V30', size: '1x12' },
]

export const PARAM_RANGE = { min: 0, max: 127 } as const
export const BANK_RANGE = { min: 1, max: 9 } as const
export const PRESET_SLOTS = ['A', 'B', 'C', 'D'] as const
export const SYSEX_MANUFACTURER_ID = [0x00, 0x32] as const

export type { AmpType }
