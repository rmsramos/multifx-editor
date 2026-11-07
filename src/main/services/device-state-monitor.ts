import type { PedalStatus } from '../../shared/types/device'

const POLL_INTERVAL_MS = 700

/**
 * Polla o estado do pedal e empurra mudanças para o renderer (sync pedal→UI).
 * - Região 0x42 (status: banco/slot/modo/bypass) a cada tick.
 * - Região 51 02 (preset ativo) imediatamente na troca de slot, senão em ticks
 *   alternados (a leitura custa ~0,4s de janela amidi; alternar alivia a porta).
 *
 * Emissão INCONDICIONAL: todo status lido com sucesso é emitido e toda live lida
 * com sucesso é emitida — sem dedup local. O renderer é quem descarta os eventos
 * redundantes (no-op estrito) e ignora eventos dentro da janela de mute pós-ação
 * da UI. Se o monitor deduplicasse aqui, um evento físico genuíno (footswitch ou
 * a posição final de um knob) que caísse na janela de mute ficaria registrado em
 * `lastStatus`/live e nunca seria re-emitido — a UI ficaria dessincronizada até a
 * PRÓXIMA mudança física. `lastStatus` é mantido APENAS para detectar troca de
 * slot (que dispara a leitura live imediata — esse comportamento de latência fica).
 *
 * Pausável (durante escritas/save/navegação — também é a supressão de eco) e
 * ciente da conexão. Reagenda-se após cada tick para nunca sobrepor leituras. Um
 * tick já em voo quando `pause()`/desconexão chega bail-a após cada await, sem
 * emitir estado meio-aplicado. Substitui o antigo TunerMonitor (o modo virou um
 * campo do status).
 */
export class DeviceStateMonitor {
  private timer: ReturnType<typeof setTimeout> | null = null
  private active = false
  private pauseCount = 0
  private lastStatus: PedalStatus | null = null // só para detectar troca de slot
  private tickCount = 0

  constructor(
    private readStatus: () => Promise<PedalStatus>,
    private readActivePreset: () => Promise<Uint8Array | null>,
    private isConnected: () => boolean,
    private emitStatus: (status: PedalStatus) => void,
    private emitActivePreset: (live: Uint8Array, status: PedalStatus) => void
  ) {}

  start(): void {
    if (this.active) return
    this.active = true
    this.schedule()
  }

  stop(): void {
    this.active = false
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  pause(): void {
    this.pauseCount++
  }

  resume(): void {
    if (this.pauseCount > 0) this.pauseCount--
  }

  private schedule(): void {
    this.timer = setTimeout(() => {
      this.timer = null
      this.tick()
        .catch(() => {})
        .finally(() => { if (this.active && this.timer === null) this.schedule() })
    }, POLL_INTERVAL_MS)
  }

  /** Uma iteração de polling. Público para teste. */
  async tick(): Promise<void> {
    if (this.pauseCount > 0 || !this.isConnected()) {
      this.lastStatus = null
      return
    }
    try {
      const status = await this.readStatus()
      if (this.pauseCount > 0 || !this.isConnected()) return
      const slotChanged = this.lastStatus === null
        || status.bankIndex !== this.lastStatus.bankIndex
        || status.slotIndex !== this.lastStatus.slotIndex
      this.lastStatus = status
      this.emitStatus(status)
      this.tickCount++
      const shouldReadLive = !status.bypass && status.slotIndex !== null
        && (slotChanged || this.tickCount % 2 === 0)
      if (shouldReadLive) {
        const live = await this.readActivePreset()
        if (this.pauseCount > 0 || !this.isConnected()) return
        if (live) {
          // Confirma que o slot não trocou durante a leitura da live (~1s de janela):
          // sem isso, um footswitch no meio do tick faria o conteúdo do slot novo ser
          // rotulado com o status do slot antigo, corrompendo o preset errado no
          // renderer (e o save na flash gravaria o preset errado).
          const verify = await this.readStatus()
          if (this.pauseCount > 0 || !this.isConnected()) return
          if (verify.bankIndex !== status.bankIndex || verify.slotIndex !== status.slotIndex) {
            // Descarta a live deste tick (o próximo entrega o par correto) e emite o
            // status verificado como uma emissão de status adicional.
            this.emitStatus(verify)
          } else {
            this.emitActivePreset(live, status)
          }
        }
      }
    } catch {
      // pedal pode não responder momentaneamente; ignora silenciosamente
    }
  }
}
