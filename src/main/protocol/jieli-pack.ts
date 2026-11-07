// Empacotamento 7↔8 bits do chip Jieli (Tank G, Cube Baby): cascata LSB-first.
// Cada grupo de 7 bytes crus (8 bits) vira 8 bytes MIDI-safe (7 bits):
//   p[i] = ((raw[i] << i) | (raw[i-1] >> (8-i))) & 0x7f   (raw[-1] = raw[7] = 0)
// Decifrado contra o hardware em 2026-06-11 (região 51 02 com preset-assinatura).

/**
 * Desempacota bytes de 7 bits (grupos de 8) em bytes crus de 8 bits (grupos de 7).
 * Um grupo final parcial com k bytes produz k-1 bytes crus (cada byte cru i precisa
 * dos packed i e i+1).
 */
export function unpackJieli(packed: ArrayLike<number>): Uint8Array {
  const out: number[] = []
  const groups = Math.floor(packed.length / 8)
  for (let g = 0; g < groups; g++) {
    const base = g * 8
    for (let i = 0; i < 7; i++) {
      out.push(((packed[base + i] >> i) | (packed[base + i + 1] << (7 - i))) & 0xff)
    }
  }
  const base = groups * 8
  const rem = packed.length - base
  for (let i = 0; i < 7 && i + 1 < rem; i++) {
    out.push(((packed[base + i] >> i) | (packed[base + i + 1] << (7 - i))) & 0xff)
  }
  return Uint8Array.from(out)
}

/** Empacota bytes crus de 8 bits (grupos de 7) em bytes de 7 bits (grupos de 8). */
export function packJieli(raw: ArrayLike<number>): Uint8Array {
  const groups = Math.ceil(raw.length / 7)
  const out = new Uint8Array(groups * 8)
  for (let g = 0; g < groups; g++) {
    const base = g * 7
    for (let i = 0; i < 8; i++) {
      const cur = i < 7 ? (raw[base + i] ?? 0) : 0
      const prev = i > 0 ? (raw[base + i - 1] ?? 0) : 0
      out[g * 8 + i] = ((cur << i) | (prev >> (8 - i))) & 0x7f
    }
  }
  return out
}
