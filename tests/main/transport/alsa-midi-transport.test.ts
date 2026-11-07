import { describe, it, expect, vi } from 'vitest'
import { AlsaMidiTransport } from '../../../src/main/transport/alsa-midi-transport'
import { packJieli } from '../../../src/main/protocol/jieli-pack'
import type { PedalStatus, SystemMode } from '../../../src/shared/types/device'

/** Monta um PedalStatus mínimo válido para os testes de navegação de modo. */
const statusOf = (mode: SystemMode): PedalStatus => ({ bankIndex: 0, slotIndex: 0, mode, bypass: false })

describe('AlsaMidiTransport.setSystemMode (navegação em malha fechada)', () => {
  it('clica CC26 depois CC27 para ir de normal a tuner', async () => {
    const t = new AlsaMidiTransport()
    const reads: SystemMode[] = ['normal', 'live', 'tuner']
    vi.spyOn(t, 'readStatus').mockImplementation(async () => statusOf(reads.shift()!))
    const clicks: number[] = []
    vi.spyOn(t, 'sendCcClick').mockImplementation(async (cc: number) => { clicks.push(cc) })

    const final = await t.setSystemMode('tuner')

    expect(final).toBe('tuner')
    expect(clicks).toEqual([26, 27])
  })

  it('não clica se já está no alvo', async () => {
    const t = new AlsaMidiTransport()
    vi.spyOn(t, 'readStatus').mockResolvedValue(statusOf('tuner'))
    const click = vi.spyOn(t, 'sendCcClick').mockResolvedValue()

    const final = await t.setSystemMode('tuner')

    expect(final).toBe('tuner')
    expect(click).not.toHaveBeenCalled()
  })

  it('clica CC27 depois CC26 para sair de tuner a normal', async () => {
    const t = new AlsaMidiTransport()
    const reads: SystemMode[] = ['tuner', 'live', 'normal']
    vi.spyOn(t, 'readStatus').mockImplementation(async () => statusOf(reads.shift()!))
    const clicks: number[] = []
    vi.spyOn(t, 'sendCcClick').mockImplementation(async (cc: number) => { clicks.push(cc) })

    const final = await t.setSystemMode('normal')

    expect(final).toBe('normal')
    expect(clicks).toEqual([27, 26])
  })

  it('lança se não alcançar o alvo após MAX_STEPS', async () => {
    const t = new AlsaMidiTransport()
    vi.spyOn(t, 'readStatus').mockResolvedValue(statusOf('normal')) // nunca muda
    vi.spyOn(t, 'sendCcClick').mockResolvedValue()

    await expect(t.setSystemMode('tuner')).rejects.toThrow('Não alcançou o modo tuner')
  })
})

describe('AlsaMidiTransport.setBypass', () => {
  const ACK = [0xf0, 0x00, 0x32, 0x01, 0x08, 0x00, 0x00, 0x00, 0x00, 0x7f, 0x01, 0xf7]

  it('envia o frame de bypass on com o índice do preset e resolve com ACK', async () => {
    const t = new AlsaMidiTransport()
    const spy = vi.spyOn(t as unknown as { sendAndReceive: (f: Uint8Array) => Promise<number[][]> }, 'sendAndReceive')
      .mockResolvedValue([ACK])

    await expect(t.setBypass(true, 5)).resolves.toBeUndefined()
    const sent = Array.from(spy.mock.calls[0][0] as Uint8Array)
    expect(sent[9]).toBe(5)     // addr[0] = índice do preset
    expect(sent[12]).toBe(0x08) // addr[3] = 08 → bypass ON
  })

  it('lança se não houver ACK', async () => {
    const t = new AlsaMidiTransport()
    vi.spyOn(t as unknown as { sendAndReceive: (f: Uint8Array) => Promise<number[][]> }, 'sendAndReceive')
      .mockResolvedValue([])

    await expect(t.setBypass(false, 0)).rejects.toThrow('Sem ACK')
  })
})

describe('AlsaMidiTransport.readAllPresets (região 50 02)', () => {
  // Resposta 0d 69 sintética no formato real: header 17 B + 24 B packed + ck ck F7.
  const reply = (index: number, raw: number[]): string => {
    const addr = 2 + 21 * index
    const bytes = [0xf0, 0x00, 0x32, 0x0d, 0x69, 0x01, 0x00, 0x00, 0x02, addr & 0x7f, (addr >> 7) & 0x7f, 0, 0,
      0x50, 0x02, 0x00, 0x00, ...packJieli(raw), 0x00, 0x00, 0xf7]
    return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
  }
  const rawOf = (i: number) => Array.from({ length: 21 }, (_, k) => (i + k) & 0x7f)

  it('lê os 36 em lote espaçado e relê só o que faltou', async () => {
    const t = new AlsaMidiTransport()
    const exec = vi.spyOn(t as any, 'amidiExec').mockImplementation(async (args: unknown) => {
      const a = args as string[]
      if (a.includes('-i')) return Array.from({ length: 36 }, (_, i) => i).filter((i) => i !== 7).map((i) => reply(i, rawOf(i))).join('\n')
      return reply(7, rawOf(7)) // releitura individual do slot que faltou
    })
    const blob = await t.readAllPresets()
    expect(blob.length).toBe(36 * 21)
    expect(Array.from(blob.subarray(7 * 21, 8 * 21))).toEqual(rawOf(7))
    expect(Array.from(blob.subarray(35 * 21, 36 * 21))).toEqual(rawOf(35))
    expect(exec).toHaveBeenCalledTimes(2)
    expect((exec.mock.calls[0][0] as string[])).toEqual(expect.arrayContaining(['-i', '30']))
  })

  it('falha explicitamente se algum slot não responde (nunca completa com fábrica)', async () => {
    const t = new AlsaMidiTransport()
    vi.spyOn(t as any, 'amidiExec').mockImplementation(async (args: unknown) =>
      (args as string[]).includes('-i') ? reply(0, rawOf(0)) : '')
    await expect(t.readAllPresets()).rejects.toThrow(/presets 1, 2/)
  })
})
