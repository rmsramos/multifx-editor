// Preset values read from the author's own pedal via `0d 41` (region `50 02`)
// with the flash in factory state. They are used as golden vectors because the
// matching save frames received a hardware ACK on 2026-06-11/12.
// 21 bytes per slot, 8-bit values, in the single enable order (0=AMP, 1=MOD,
// 2=DELAY, 3=REVERB).
export const PEDAL_SLOTS: Readonly<Record<0 | 4 | 6 | 13 | 32 | 34 | 35, readonly number[]>> = {
  0: [1, 0, 0, 1, 0, 0, 99, 63, 63, 63, 100, 0, 0, 0, 127, 12, 2, 0, 255, 255, 0],
  4: [1, 1, 0, 0, 0, 0, 82, 25, 16, 107, 127, 39, 25, 0, 0, 0, 0, 0, 255, 0, 0],
  6: [1, 0, 0, 1, 0, 2, 59, 63, 63, 63, 127, 0, 0, 3, 60, 54, 0, 4, 0, 170, 127],
  13: [1, 0, 0, 1, 0, 0, 89, 63, 63, 92, 127, 0, 0, 0, 0, 118, 2, 0, 255, 255, 127],
  32: [1, 0, 0, 1, 0, 0, 94, 90, 63, 63, 100, 0, 0, 0, 0, 12, 5, 0, 255, 0, 0],
  34: [1, 0, 0, 1, 76, 8, 74, 80, 50, 64, 55, 0, 0, 0, 0, 56, 0, 1, 255, 170, 255],
  35: [1, 0, 1, 1, 0, 8, 79, 66, 70, 84, 50, 0, 0, 49, 55, 12, 8, 8, 85, 255, 127],
}

// Deterministic 36 x 21 byte blob (no A5 5A header) built by a fixed rule,
// inside the ranges accepted by `decodePreset`. Unrelated to PEDAL_SLOTS.
export function syntheticPresetBlob(): Uint8Array {
  const out = new Uint8Array(36 * 21)
  for (let k = 0; k < 36; k++) {
    const s = out.subarray(k * 21, k * 21 + 21)
    for (let i = 0; i < 4; i++) s[i] = (k >> i) & 1
    for (let i = 4; i < 17; i++) s[i] = (k * 7 + i * 13) % 128
    s[5] = k % 9
    s[11] = k % 3
    s[17] = (k * 5) % 9
    for (let i = 18; i < 21; i++) s[i] = (k * 37 + i * 91) % 256
  }
  return out
}
