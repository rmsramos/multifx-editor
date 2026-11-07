#!/usr/bin/env node
// CLI para exercer o transporte ALSA-MIDI contra o pedal M-VAVE Tank G real (sem a UI Electron).
// Requer alsa-utils (amidi) e o pedal conectado via USB. Libere a porta antes
// (feche o app oficial / pare o container Wine).
//
//   node scripts/multifx-cli.mjs discover
//   node scripts/multifx-cli.mjs set <addr_hex> <valor>     # ex.: set 06 80  (Gain)
//   node scripts/multifx-cli.mjs ports
//
// Reimplementa a lógica do amidi em .mjs puro para rodar sem build do TS.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const run = promisify(execFile)

const SYSEX = [0x00, 0x32]
const hex = (a) => a.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
function ck(body) { const s = body.reduce((a, b) => a + b, 0); const c = ((670 - 2 * s) % 0x4000 + 0x4000) % 0x4000; return [c & 0x7f, (c >> 7) & 0x7f] }
function paramWrite(addr, val) { const b = [0x09, 0x49, 0, 0, 0, 0x02, addr & 0xff, 0, 0, 0, 0x11, 0, 0, 0, val & 0x7f]; const [c1, c2] = ck(b); return [0xf0, ...SYSEX, ...b, c1, c2, 0xf7] }
const discovery = () => [0xf0, ...SYSEX, 0x45, 0x00, 0x00, 0x00, 0x40, 0x7f, 0xf7]
function parseFrames(s) { const h = s.replace(/[^0-9a-fA-F]/g, ''); const by = []; for (let i = 0; i + 1 < h.length; i += 2) by.push(parseInt(h.slice(i, i + 2), 16)); const fr = []; let c = null; for (const b of by) { if (b === 0xf0) c = [b]; else if (c) { c.push(b); if (b === 0xf7) { fr.push(c); c = null } } } return fr }

async function findPort() {
  const { stdout } = await run('amidi', ['-l'])
  for (const line of stdout.split('\n')) {
    const m = line.match(/(hw:\d+,\d+(?:,\d+)?)/)
    if (m && /USB Composite Device|TANK/i.test(line)) return m[1]
  }
  throw new Error('Pedal M-VAVE Tank G não encontrado em amidi -l')
}

async function sendRecv(port, frame, t = 2) {
  const { stdout } = await run('amidi', ['-p', port, '-S', hex(frame), '-d', '-t', String(t)], { timeout: (t + 2) * 1000 })
  return parseFrames(stdout)
}

const [cmd, ...args] = process.argv.slice(2)
const USAGE = 'uso: discover | set <addr_hex> <valor> | select <0-35> | ports'
if (!cmd || cmd === '--help' || cmd === '-h') {
  console.error(USAGE)
  process.exit(cmd ? 0 : 1)
}
const port = await findPort()
console.error(`porta: ${port}`)

if (cmd === 'ports') {
  const { stdout } = await run('amidi', ['-l']); console.log(stdout)
} else if (cmd === 'discover') {
  const fr = await sendRecv(port, discovery())
  const r = fr.find((f) => f[3] === 0x45 && f[4] === 0x58)
  console.log(r ? `OK, discovery respondeu: ${hex(r)}` : 'sem resposta de discovery')
} else if (cmd === 'select') {
  const prog = Math.max(0, Math.min(35, Number(args[0]))) & 0x7f
  const pc = `C0 ${prog.toString(16).padStart(2, '0').toUpperCase()}`
  console.log(`TX (Program Change): ${pc}  (preset ${prog})`)
  await run('amidi', ['-p', port, '-S', pc], { timeout: 3000 })
  console.log('enviado (PC é silencioso, confira o display do pedal)')
} else if (cmd === 'set') {
  const addr = parseInt(args[0], 16), val = Number(args[1])
  const frame = paramWrite(addr, val)
  console.log(`TX: ${hex(frame)}`)
  const fr = await sendRecv(port, frame)
  const ack = fr.find((f) => f[3] === 0x01 && f[4] === 0x08)
  console.log(ack ? `OK, ACK: ${hex(ack)}` : `SEM ACK (recebido: ${fr.map(hex).join(' | ') || 'nada'})`)
} else {
  console.error(USAGE)
  process.exit(1)
}
