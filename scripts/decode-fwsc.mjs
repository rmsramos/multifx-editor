#!/usr/bin/env node
// Inspeciona um arquivo de firmware OTA da M-Vave (.fwsc), formato Jieli.
// Fase 1 (observação). Baseado em evidência: docs/protocol/ota-firmware.md
//
// O que É conhecido (confirmado):
//   - Footer magic ASCII "JLUFW" (Jieli Upgrade FirmWare) na cauda do arquivo, seguido de padding.
//   - Payload NÃO é cifra forte (entropia < 8 bits/byte, com picos em ff/00, firmware cru/scrambled).
// O que NÃO é conhecido (Fase 2):
//   - Onde/como Name e Version estão codificados no header (não estão em ASCII claro;
//     resistiram a XOR/bit-reverse/unpack-MIDI). O app oficial os extrai; nós ainda não.
//
// uso: node scripts/decode-fwsc.mjs <arquivo.fwsc>

import { readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('uso: decode-fwsc.mjs <arquivo.fwsc>')
  process.exit(1)
}

const MAGIC = Buffer.from('JLUFW', 'latin1')
const FOOTER_WINDOW = 64 // o magic é um footer: só o procuramos na cauda do arquivo
const buf = readFileSync(file)

// Procura o magic APENAS na janela final, evita falso-positivo de "JLUFW" solto no meio.
const tailStart = Math.max(0, buf.length - FOOTER_WINDOW)
const relIdx = buf.subarray(tailStart).lastIndexOf(MAGIC)
const magicOffset = relIdx >= 0 ? tailStart + relIdx : -1
const valid = magicOffset >= 0

// Entropia de Shannon (bits/byte): ~8.0 ⇒ cifrado/comprimido; nitidamente < 8 ⇒ estrutura/padding.
const freq = new Array(256).fill(0)
for (const b of buf) freq[b]++
let entropy = 0
for (const c of freq) {
  if (!c) continue
  const p = c / buf.length
  entropy -= p * Math.log2(p)
}
const top = freq
  .map((c, b) => ({ b, c }))
  .sort((x, y) => y.c - x.c)
  .slice(0, 4)

console.log(`Arquivo:      ${file}`)
console.log(`Tamanho:      ${buf.length} bytes`)
console.log(`Magic JLUFW:  ${valid ? `OK (footer @ 0x${magicOffset.toString(16)})` : 'AUSENTE na cauda (não parece um .fwsc Jieli)'}`)
if (valid) {
  console.log(`Após o magic: ${buf.length - (magicOffset + MAGIC.length)} bytes (padding)`)
}
console.log(`Top bytes:    ${top.map((t) => `${t.b.toString(16).padStart(2, '0')}×${t.c}`).join('  ')}`)
console.log(`Entropia:     ${entropy.toFixed(2)} bits/byte  ${entropy > 7.9 ? '(≈aleatório: cifrado/comprimido)' : '(<8: há estrutura, não é cifra forte)'}`)
console.log('Name/Version: codificados no header, não decodificados nesta fase (ver Fase 2).')

process.exit(valid ? 0 : 1)
