import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { Transport } from './transport'
import type { ConnectionStatus, DeviceInfo, DiscoveredDevice, PedalStatus, SystemMode } from '../../shared/types/device'
import type { Preset } from '../../shared/types/preset'
import {
  buildDiscovery,
  buildFlashCommit,
  buildParamWrite,
  buildPresetSave,
  buildStoredPresetRead,
  parseStoredPresets,
  parseSysexFrames,
  isAck,
  buildStatusRead,
  parsePedalStatus,
  buildActivePresetRead,
  parseActivePreset,
  buildCcClick,
  nextClickToward,
  buildBypass,
  parseDiscoveryReply,
} from '../protocol/mvave-codec'

const execFileAsync = promisify(execFile)

/** Espaço entre as leituras em lote da região 50 02 (sem ele o pedal ignora a rajada). */
const STORED_READ_INTERVAL_MS = 30

// O Tank G é USB-MIDI class-compliant; o kernel o expõe como porta ALSA rawmidi.
// Falamos com ele via `amidi` (alsa-utils) — sem dependência nativa, validado contra
// o hardware em 2026-06-10. Ver docs/protocol/usb-sysex.md.
const TANK_G_PORT_PATTERN = /USB Composite Device|TANK/i
// O -t do amidi é timeout de INATIVIDADE: ele só encerra após esse tempo de silêncio,
// então a janela inteira é paga em TODA chamada. O pedal responde em poucos ms — 0.3s
// dá folga e mantém cada write rápido (medido no hardware: roundtrip 0,30s).
const RESPONSE_TIMEOUT_S = 0.3
const CLICK_PRESS_HOLD_MS = 220 // ~200ms entre press e release (clique mais rápido o firmware ignora)
const CLICK_SETTLE_MS = 320     // acomodação após o release antes da próxima leitura
const SET_MODE_MAX_STEPS = 8
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const hex = (bytes: ArrayLike<number>): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')

/** Converte a saída de texto do `amidi -d` (hex contínuo) em bytes. */
function parseAmidiDump(stdout: string): number[] {
  const clean = stdout.replace(/[^0-9a-fA-F]/g, '')
  const out: number[] = []
  for (let i = 0; i + 1 < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16))
  return out
}

export class AlsaMidiTransport implements Transport {
  private port: string | null = null
  private info: DeviceInfo | null = null
  private status: ConnectionStatus = 'disconnected'
  private statusCallback?: (status: ConnectionStatus) => void
  private opQueue: Promise<unknown> = Promise.resolve()

  private setStatus(status: ConnectionStatus): void {
    this.status = status
    this.statusCallback?.(status)
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.statusCallback = callback
  }

  getStatus(): ConnectionStatus {
    return this.status
  }

  /**
   * Lista as portas ALSA rawmidi que parecem ser um Tank G. Silencioso quanto ao
   * status de conexão — é usado como sonda periódica de reconexão pelo renderer.
   */
  async scan(): Promise<DiscoveredDevice[]> {
    try {
      const { stdout } = await execFileAsync('amidi', ['-l'])
      const devices: DiscoveredDevice[] = []
      for (const line of stdout.split('\n')) {
        const m = line.match(/(hw:\d+,\d+(?:,\d+)?)\s+(.+?)\s*$/)
        if (m && TANK_G_PORT_PATTERN.test(line)) {
          devices.push({ id: m[1], name: m[2].trim() })
        }
      }
      return devices
    } catch (error) {
      throw new Error(`Failed to list MIDI ports (is amidi installed?): ${(error as Error).message}`)
    }
  }

  async connect(deviceId?: string): Promise<DeviceInfo> {
    this.setStatus('connecting')
    try {
      this.port = deviceId ?? (await this.scan())[0]?.id ?? null
      if (!this.port) throw new Error('No compatible pedal found on the MIDI ports')

      // Handshake: discovery deve retornar um frame com cmd 0x45 0x58.
      const frames = await this.sendAndReceive(buildDiscovery())
      const reply = frames.find((f) => f[3] === 0x45 && f[4] === 0x58)
      if (!reply) throw new Error('The pedal did not answer the discovery request')

      const { model, firmware } = parseDiscoveryReply(reply)
      this.info = {
        id: this.port,
        name: 'Tank G',
        serialNumber: hex(reply.slice(8, 18)),
        model,
        ...(firmware !== null ? { firmware } : {}),
      }
      this.setStatus('connected')
      return this.info
    } catch (error) {
      this.setStatus('error')
      throw error
    }
  }

  /** Info do último handshake (sem tráfego MIDI); null quando desconectado. */
  getInfo(): DeviceInfo | null {
    return this.port ? this.info : null
  }

  async disconnect(): Promise<void> {
    this.port = null
    this.info = null
    this.setStatus('disconnected')
  }

  /** Serializa operações amidi: a porta rawmidi é exclusiva — uma de cada vez. */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.opQueue.then(fn, fn)
    this.opQueue = run.then(() => undefined, () => undefined)
    return run
  }

  /**
   * Executa o `amidi` com retry em "Device or resource busy" — a porta rawmidi é
   * exclusiva e demora alguns ms para liberar entre processos amidi sucessivos.
   * Serializado via opQueue para evitar contenção entre chamadas concorrentes.
   */
  private async amidiExec(extraArgs: string[], timeoutMs = 4000): Promise<string> {
    return this.enqueue(async () => {
      if (!this.port) throw new Error('Não conectado')
      const args = ['-p', this.port, ...extraArgs]
      let lastErr: unknown
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          const { stdout } = await execFileAsync('amidi', args, { timeout: timeoutMs })
          return stdout
        } catch (e) {
          lastErr = e
          const msg = (e as { stderr?: string }).stderr ?? ''
          if (!/busy|resource/i.test(msg)) throw e
          await new Promise((r) => setTimeout(r, 60))
        }
      }
      throw lastErr
    })
  }

  /** Envia um frame SysEx e devolve os frames recebidos durante a janela de resposta. */
  private async sendAndReceive(frame: Uint8Array, timeoutS = RESPONSE_TIMEOUT_S): Promise<number[][]> {
    const stdout = await this.amidiExec(['-S', hex(frame), '-d', '-t', String(timeoutS)], (timeoutS + 2) * 1000)
    return parseSysexFrames(parseAmidiDump(stdout))
  }

  /** Seleciona o preset ativo via MIDI Program Change (índice 0-35). Silencioso (sem ACK). */
  async selectPreset(index: number): Promise<void> {
    const prog = Math.max(0, Math.min(35, index)) & 0x7f
    const pc = `C0 ${prog.toString(16).padStart(2, '0').toUpperCase()}`
    await this.amidiExec(['-S', pc])
  }

  /**
   * Lê o status do pedal (banco/slot/modo/bypass) da região 0x42. Timeout 1s:
   * é a leitura de polling do monitor, a janela cobre o pacing lento do pedal.
   */
  async readStatus(): Promise<PedalStatus> {
    const frames = await this.sendAndReceive(buildStatusRead(), 1)
    const status = parsePedalStatus(frames)
    if (!status) throw new Error('Pedal não respondeu à leitura de status (região 0x42)')
    return status
  }

  /** Lê o preset ativo (21 bytes live-order) ou null (sem resposta / bypass). */
  async readActivePreset(): Promise<Uint8Array | null> {
    const frames = await this.sendAndReceive(buildActivePresetRead(), 1)
    return parseActivePreset(frames)
  }

  /**
   * Emula um clique de footswitch (press 127 + release 0) com o pacing que o firmware exige.
   * A contenção de porta é serializada pela opQueue; o tempo MÍNIMO de hold (CLICK_PRESS_HOLD_MS)
   * é garantido pelo delay, não pela ausência de outras operações. Se uma escrita ao vivo se
   * intercalar entre press e release, o hold só fica MAIOR — o firmware lê como clique longo,
   * o que é inofensivo (o que ele ignora é clique curto demais).
   */
  async sendCcClick(cc: number): Promise<void> {
    const { press, release } = buildCcClick(cc)
    await this.amidiExec(['-S', press])
    await delay(CLICK_PRESS_HOLD_MS)
    await this.amidiExec(['-S', release])
    await delay(CLICK_SETTLE_MS)
  }

  /** Navega até `target` em malha fechada: lê, clica em direção ao alvo, relê, repete. */
  async setSystemMode(target: SystemMode): Promise<SystemMode> {
    for (let step = 0; step < SET_MODE_MAX_STEPS; step++) {
      const status = await this.readStatus()
      if (status.mode === null) throw new Error('Pedal em bypass — não é possível navegar de modo')
      const current = status.mode
      if (current === target) return current
      const cc = nextClickToward(current, target)
      if (cc === null) return current
      await this.sendCcClick(cc)
    }
    const final = (await this.readStatus()).mode
    if (final !== target) throw new Error(`Não alcançou o modo ${target} (parou em ${final})`)
    return final
  }

  /** Liga/desliga o bypass do preset `index` (0-35) e confirma o ACK do device. */
  async setBypass(on: boolean, index: number): Promise<void> {
    const frames = await this.sendAndReceive(buildBypass(on, index))
    if (!frames.some(isAck)) throw new Error(`Sem ACK ao ${on ? 'ligar' : 'desligar'} o bypass`)
  }

  /** Escreve um byte de parâmetro no preset ativo e confirma o ACK do device. */
  async writeParam(addr: number, value: number): Promise<void> {
    const frames = await this.sendAndReceive(buildParamWrite(addr, value))
    if (!frames.some(isAck)) {
      throw new Error(`Sem ACK ao escrever addr 0x${addr.toString(16)} = ${value}`)
    }
  }

  /**
   * Salva o preset no slot da FLASH (persiste após desligar): 09 69 (registro
   * Jieli-packed no storage do slot) + 09 41 (commit). Ambos exigem ACK.
   * Mecanismo e checksum decifrados em 2026-06-11 (ver docs/protocol/usb-sysex.md).
   */
  async savePreset(index: number, preset: Preset): Promise<void> {
    const save = await this.sendAndReceive(buildPresetSave(index, preset))
    if (!save.some(isAck)) throw new Error(`Sem ACK ao gravar preset no slot ${index}`)
    const commit = await this.sendAndReceive(buildFlashCommit())
    if (!commit.some(isAck)) throw new Error('Sem ACK no commit da flash (09 41)')
  }

  /**
   * Lê os 36 presets da flash (região 0x5e60): resposta 0d 71 com payload
   * Jieli-packed que desempacota para A5 5A + 36×21 bytes (mesmo formato do .atkg).
   * Decifrado contra o hardware em 2026-06-11.
   */
  async readAllPresets(): Promise<Uint8Array> {
    // As 36 leituras vão num único amidi, espaçadas (-i): sem intervalo o pedal descarta
    // a rajada inteira; com 30 ms responde as 36 em ~2 s (medido em 2026-11-02).
    const all = Array.from({ length: 36 }, (_, i) => hex(buildStoredPresetRead(i))).join(' ')
    const stdout = await this.amidiExec(
      ['-i', String(STORED_READ_INTERVAL_MS), '-S', all, '-d', '-t', '1'],
      12_000
    )
    const found = parseStoredPresets(parseSysexFrames(parseAmidiDump(stdout)))
    // Resposta perdida: relê só os slots que faltaram, um a um.
    for (let i = 0; i < 36; i++) {
      if (found.has(i)) continue
      const retry = parseStoredPresets(await this.sendAndReceive(buildStoredPresetRead(i), 1))
      const raw = retry.get(i)
      if (raw) found.set(i, raw)
    }
    const missing = Array.from({ length: 36 }, (_, i) => i).filter((i) => !found.has(i))
    if (missing.length > 0) {
      throw new Error(`Pedal não respondeu à leitura dos presets ${missing.join(', ')} (região 50 02)`)
    }
    const blob = new Uint8Array(36 * 21)
    for (const [i, raw] of found) blob.set(raw, i * 21)
    return blob
  }

}
