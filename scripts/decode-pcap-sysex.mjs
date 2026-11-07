#!/usr/bin/env node
/**
 * Decodifica um pcap de usbmon (linktype 220, header mmapped de 64 bytes) em
 * frames SysEx completos — sem o truncamento de ~32 bytes da interface de texto.
 *
 * uso: node scripts/decode-pcap-sysex.mjs <arquivo.pcap> [filtro-hex ex.: "09 69"]
 */
import { readFileSync } from 'node:fs'

const file = process.argv[2]
const filter = process.argv[3]?.toLowerCase()
if (!file) { console.error('uso: decode-pcap-sysex.mjs <pcap> [filtro]'); process.exit(1) }

const buf = readFileSync(file)
if (buf.readUInt32LE(0) !== 0xa1b2c3d4) throw new Error('magic pcap inesperado (esperado LE clássico)')
const linktype = buf.readUInt32LE(20)
if (linktype !== 220) throw new Error(`linktype ${linktype} não suportado (esperado 220 usbmon mmapped)`)

const hex = (a) => Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join(' ')

// Remontagem de SysEx por direção (USB-MIDI: pacotes de 4 bytes, CIN 4-7)
const assembler = { in: [], out: [] }
const frames = [] // {dir, ts, bytes}

function feed(dir, ts, data) {
  const cur = assembler[dir]
  for (let i = 0; i + 3 < data.length; i += 4) {
    const cin = data[i] & 0x0f
    if (cin < 0x04 || cin > 0x07) continue
    const n = cin === 0x05 ? 1 : cin === 0x06 ? 2 : 3
    for (let j = 1; j <= n; j++) cur.push(data[i + j])
    if (cin >= 0x05) {
      frames.push({ dir, ts, bytes: cur.slice() })
      cur.length = 0
    }
  }
}

let off = 24
while (off + 16 <= buf.length) {
  const tsSec = buf.readUInt32LE(off)
  const tsUsec = buf.readUInt32LE(off + 4)
  const inclLen = buf.readUInt32LE(off + 8)
  off += 16
  if (off + inclLen > buf.length) break
  const pkt = buf.subarray(off, off + inclLen)
  off += inclLen
  if (inclLen < 64) continue

  const type = pkt[8] // 'S'=0x53 submission, 'C'=0x43 completion
  const xferType = pkt[9] // 3 = bulk
  const epnum = pkt[10]
  const lenCap = pkt.readUInt32LE(36)
  if (xferType !== 3 || lenCap === 0) continue
  const data = pkt.subarray(64, 64 + lenCap)
  const ts = tsSec + tsUsec / 1e6

  if ((epnum & 0x80) === 0 && type === 0x53) feed('out', ts, data) // TX no EP OUT
  else if ((epnum & 0x80) !== 0 && type === 0x43) feed('in', ts, data) // RX no EP IN
}

const t0 = frames[0]?.ts ?? 0
for (const f of frames) {
  const line = hex(f.bytes)
  if (filter && !line.includes(filter)) continue
  console.log(`[+${(f.ts - t0).toFixed(3)}s] ${f.dir === 'out' ? 'TX' : 'RX'} (${f.bytes.length}B) ${line}`)
}
