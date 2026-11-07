import { PRESET_BYTE_LENGTH } from '../protocol/preset-codec'
import { presetToLiveBytes } from '../protocol/mvave-codec'
import { PRESET_PARAM_ADDRESSES } from '../protocol/mvave-codec'
import type { Preset } from '../../shared/types/preset'
import type { SyncState } from '../../shared/types/device'

type WriteParamFn = (addr: number, value: number) => Promise<void>

/**
 * Fila serializada de escrita de parâmetros ao vivo. O amidi não tolera
 * concorrência, então um único worker drena a fila em ordem.
 *
 * Funciona em dois rounds:
 * - Round atual: drena as escritas agendadas pelo enqueuePreset que iniciou o drain.
 * - Round seguinte: se enqueuePreset é chamado durante um drain, o novo preset fica em
 *   pendingPreset e é processado (com diff vs lastApplied) ao término do round atual.
 *   Múltiplas chamadas durante o mesmo round coalescem — só o preset mais recente conta.
 */
export class ParamWriteQueue {
  private pending = new Map<number, number>()   // fila do round atual
  private pendingPreset: number[] | null = null  // preset aguardando próximo round
  private lastApplied: number[] | null = null    // bytes do último preset totalmente aplicado
  private draining = false
  private invalidateGen = 0  // geração de invalidate; incrementado a cada invalidate()
  private state: SyncState = 'synced'
  private stateCallback?: (state: SyncState) => void

  constructor(private writeParam: WriteParamFn) {}

  onStateChange(callback: (state: SyncState) => void): void {
    this.stateCallback = callback
  }

  getState(): SyncState {
    return this.state
  }

  private setState(state: SyncState): void {
    if (state === this.state) return
    this.state = state
    this.stateCallback?.(state)
  }

  /** Esquece o último estado aplicado (troca de preset no pedal, reconexão). */
  invalidate(): void {
    this.lastApplied = null
    this.pendingPreset = null
    // Incrementa geração para que qualquer drain em curso não sobrescreva o null acima
    this.invalidateGen++
  }

  /** Diff do preset vs último aplicado; enfileira só o que mudou e drena. */
  enqueuePreset(preset: Preset): void {
    const bytes = presetToLiveBytes(preset)
    if (!this.draining) {
      // Sem drain em progresso: o novo preset é a fonte de verdade — descarta qualquer
      // pendingPreset stale que possa ter ficado de um round anterior (ex.: após erro).
      this.pendingPreset = null
      // Calcula diff e inicia round
      for (const addr of PRESET_PARAM_ADDRESSES) {
        if (!this.lastApplied || this.lastApplied[addr] !== bytes[addr]) {
          this.pending.set(addr, bytes[addr])
        }
      }
      if (this.pending.size > 0) void this.drain()
    } else {
      // Drain em progresso: armazena para o próximo round (coalescing automático)
      this.pendingPreset = bytes
    }
  }

  /** Tenta drenar de novo o que ficou pendente após um erro. */
  async retry(): Promise<void> {
    await this.drain()
  }

  private async drain(): Promise<void> {
    if (this.draining) return
    this.draining = true
    this.setState('applying')
    // Captura geração de invalidate no início do drain. Se invalidate() for chamado durante
    // o drain, a geração muda e as escritas subsequentes NÃO sobrescrevem o null resultante,
    // preservando o estado "precisa reescrita completa" para o próximo enqueuePreset.
    const drainGen = this.invalidateGen

    while (this.pending.size > 0) {
      const [addr, value] = this.pending.entries().next().value as [number, number]
      this.pending.delete(addr)
      try {
        await this.writeParam(addr, value)
        // Atualiza lastApplied apenas se nenhum invalidate() ocorreu desde o início deste drain
        if (this.invalidateGen === drainGen) {
          if (!this.lastApplied) this.lastApplied = new Array(PRESET_BYTE_LENGTH).fill(0) as number[]
          this.lastApplied[addr] = value
        }
      } catch {
        // Devolve o endereço falho à frente da fila (preserva ordem) e para o worker
        const requeued = new Map<number, number>()
        requeued.set(addr, value)
        for (const [k, v] of this.pending) requeued.set(k, v)
        this.pending = requeued
        this.draining = false
        this.setState('error')
        return
      }
    }

    // Round completo com sucesso
    this.draining = false

    if (this.pendingPreset !== null) {
      // Há um preset acumulado: calcula diff vs o que foi aplicado e inicia próximo round
      const nextBytes = this.pendingPreset
      this.pendingPreset = null
      for (const addr of PRESET_PARAM_ADDRESSES) {
        if (!this.lastApplied || this.lastApplied[addr] !== nextBytes[addr]) {
          this.pending.set(addr, nextBytes[addr])
        }
      }
      if (this.pending.size > 0) {
        void this.drain()
        return
      }
    }

    this.setState('synced')
  }
}
