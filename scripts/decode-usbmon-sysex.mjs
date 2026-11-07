#!/usr/bin/env node
// Decodifica uma captura de TEXTO do usbmon, remontando o SysEx M-VAVE que trafega
// dentro do framing USB-MIDI (pacotes de 4 bytes com CIN). Filtra por device USB.
//
// Captura (root): sudo cat /sys/kernel/debug/usb/usbmon/1u > scripts/captures/cap.txt
// Decodifica:     node scripts/decode-usbmon-sysex.mjs scripts/captures/cap.txt [--dev 9] [--uniq] [--after <ts>]
//
// --uniq   agrupa frames idênticos com contagem (bom para ver o vocabulário)
// --after  só eventos com timestamp (us) >= valor (isola uma ação específica)

import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--'))
const dev = (() => { const i = args.indexOf('--dev'); return i >= 0 ? args[i + 1] : null })()
const uniq = args.includes('--uniq')
const after = (() => { const i = args.indexOf('--after'); return i >= 0 ? Number(args[i + 1]) : 0 })()
if (!file) { console.error('uso: decode-usbmon-sysex.mjs <cap.txt> [--dev N] [--uniq] [--after ts]'); process.exit(1) }

// USB-MIDI (4 bytes por evento): [CIN/cable][b1][b2][b3]. Remonta um stream de SysEx.
function usbMidiToSysex(bytes) {
  const out = []
  for (let i = 0; i + 3 < bytes.length || i < bytes.length; i += 4) {
    const cin = bytes[i] & 0x0f
    const d = [bytes[i + 1], bytes[i + 2], bytes[i + 3]]
    if (cin === 0x4) out.push(d[0], d[1], d[2])
    else if (cin === 0x5) out.push(d[0])
    else if (cin === 0x6) out.push(d[0], d[1])
    else if (cin === 0x7) out.push(d[0], d[1], d[2])
  }
  const end = out.indexOf(0xf7)
  return end >= 0 ? out.slice(0, end + 1) : out
}

const hex = (a) => a.map((b) => b.toString(16).padStart(2, '0')).join(' ')
const text = readFileSync(file, 'utf8')
const counts = new Map()
const rows = []

for (const line of text.split('\n')) {
  const m = line.match(/^\S+ (\d+) ([SC]) B([io]):(\d+):(\d+):(\d+) [0-9-]+ \d+ = (\S.*)$/)
  if (!m) continue
  const [, ts, , io, , devNum, , data] = m
  if (dev != null && Number(devNum) !== Number(dev)) continue
  if (Number(ts) < after) continue
  const raw = data.replace(/\s/g, '')
  if (!raw.startsWith('04f00032')) continue // só SysEx M-VAVE
  const bytes = raw.match(/../g).map((x) => parseInt(x, 16))
  const sx = usbMidiToSysex(bytes)
  const dir = io === 'o' ? 'TX' : 'RX'
  const cmd = sx.length >= 5 ? hex(sx.slice(3, 5)) : '??'
  if (uniq) {
    const key = `${dir} [${cmd}] ${hex(sx)}`
    counts.set(key, (counts.get(key) || 0) + 1)
  } else {
    rows.push(`[${ts}] ${dir} [${cmd}]  ${hex(sx)}`)
  }
}

if (uniq) {
  for (const [k, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(String(n).padStart(5), k)
  }
} else {
  for (const r of rows) console.log(r)
}
