#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'

export const HEADER_SIZE = 16
export const RECORD_HEADER_SIZE = 24

/**
 * Parse btsnoop file header (RFC 1761).
 * Magic "btsnoop\0" + version (u32 BE) + datalink type (u32 BE).
 * Datalink 1002 = HCI with direction, usado por Android HCI snoop.
 */
export function parseBtsnoopHeader(buf) {
  if (buf.length < HEADER_SIZE) {
    throw new Error(`Header muito curto: ${buf.length} < ${HEADER_SIZE}`)
  }
  const magic = buf.subarray(0, 8).toString('binary')
  if (!magic.startsWith('btsnoop')) {
    throw new Error(`Magic inválido: ${JSON.stringify(magic)}`)
  }
  return {
    version: buf.readUInt32BE(8),
    datalinkType: buf.readUInt32BE(12),
  }
}

/**
 * Parse one btsnoop record header + payload.
 * Header: origLen, inclLen, flags, cumDrops (u32 BE cada) + timestamp (u64 BE).
 * Retorna {rec, consumed} — consumed = bytes totais do registro (header + payload).
 */
export function parseBtsnoopRecord(buf, offset) {
  if (buf.length - offset < RECORD_HEADER_SIZE) {
    throw new Error(`Registro truncado em offset ${offset}`)
  }
  const origLen = buf.readUInt32BE(offset)
  const inclLen = buf.readUInt32BE(offset + 4)
  const flags = buf.readUInt32BE(offset + 8)
  const cumDrops = buf.readUInt32BE(offset + 12)
  const tsHigh = buf.readUInt32BE(offset + 16)
  const tsLow = buf.readUInt32BE(offset + 20)
  const timestamp = (BigInt(tsHigh) << 32n) | BigInt(tsLow)
  const payload = buf.subarray(
    offset + RECORD_HEADER_SIZE,
    offset + RECORD_HEADER_SIZE + inclLen
  )
  return {
    rec: { origLen, inclLen, flags, cumDrops, timestamp, payload },
    consumed: RECORD_HEADER_SIZE + inclLen,
  }
}

/**
 * Classifica flags do registro.
 * Bit 0: 0=sent (host→controller), 1=received (controller→host)
 * Bit 1: 0=data, 1=command/event
 */
export function describeFlags(flags) {
  const direction = (flags & 0x01) ? 'in' : 'out'
  const isCmd = !!(flags & 0x02)
  return { direction, isCmd }
}

function main() {
  const [,, inPath, outPath] = process.argv
  if (!inPath) {
    console.error('Uso: decode-btsnoop.mjs <arquivo.log> [saida.csv]')
    console.error('Se saida.csv omitido, usa <arquivo>.csv')
    process.exit(1)
  }
  const out = outPath || inPath + '.csv'
  const buf = readFileSync(inPath)
  const header = parseBtsnoopHeader(buf)
  console.log(`btsnoop v${header.version}, datalink ${header.datalinkType} (1002 = HCI com direção)`)

  const rows = ['timestamp_us,direction,cmd,origLen,inclLen,hex']
  let offset = HEADER_SIZE
  let count = 0
  while (offset < buf.length) {
    const { rec, consumed } = parseBtsnoopRecord(buf, offset)
    const { direction, isCmd } = describeFlags(rec.flags)
    rows.push(
      `${rec.timestamp},${direction},${isCmd ? 1 : 0},${rec.origLen},${rec.inclLen},${rec.payload.toString('hex')}`
    )
    offset += consumed
    count++
  }
  writeFileSync(out, rows.join('\n') + '\n')
  console.log(`✓ Escrito ${out} com ${count} registros`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
