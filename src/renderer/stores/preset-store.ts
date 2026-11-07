import { create } from 'zustand'
import type { Preset, PresetSlot } from '@shared/types/preset'
import type { ConnectionStatus, DeviceInfo, PedalStatus, SyncState, SystemMode } from '@shared/types/device'

type ToastVariant = 'success' | 'error'

function createDefaultPreset(bank: number, slot: PresetSlot): Preset {
  return {
    bank, slot,
    noiseGate: 0,
    amp: { enabled: true, type: '1J120_CL · JC-120 Jazz Chorus', gain: 64, treble: 64, middle: 64, bass: 64, volume: 64 },
    mod: { enabled: false, speed: 64, fx: 64 },
    delay: { enabled: false, time: 64, mix: 20 },
    reverb: { enabled: false, mix: 64, decay: 20 },
    irCab: 0,
    color: { r: 0, g: 0, b: 255 },
  }
}

function generateDefaultPresets(): Preset[] {
  const slots: PresetSlot[] = ['A', 'B', 'C', 'D']
  return Array.from({ length: 36 }, (_, i) =>
    createDefaultPreset(Math.floor(i / 4) + 1, slots[i % 4])
  )
}

function presetIndex(bank: number, slot: PresetSlot): number {
  const slotIdx = ['A', 'B', 'C', 'D'].indexOf(slot)
  return (bank - 1) * 4 + slotIdx
}

/**
 * Igualdade de presets ignorando bank/slot (já validados pelo chamador) e o LSB
 * das cores (leitura live do pedal é 7-bit). Comparação estrutural campo a campo:
 * JSON.stringify seria sensível à ordem de chaves, que difere entre o shape do
 * codec (decodePreset) e o do store.
 */
/**
 * Cor do buffer ao vivo × cor do preset: 8 bits após troca de preset (igual, a menos do LSB)
 * ou 7 bits logo após uma escrita nossa (value>>1). Aceita as duas formas, em qualquer ordem.
 */
function colorChannelMatches(a: number, b: number): boolean {
  return (a >> 1) === (b >> 1) || a === b >> 1 || b === a >> 1
}

function presetsEquivalent(a: Preset, b: Preset): boolean {
  return (
    a.noiseGate === b.noiseGate &&
    a.irCab === b.irCab &&
    a.amp.enabled === b.amp.enabled &&
    a.amp.type === b.amp.type &&
    a.amp.gain === b.amp.gain &&
    a.amp.treble === b.amp.treble &&
    a.amp.middle === b.amp.middle &&
    a.amp.bass === b.amp.bass &&
    a.amp.volume === b.amp.volume &&
    a.mod.enabled === b.mod.enabled &&
    a.mod.speed === b.mod.speed &&
    a.mod.fx === b.mod.fx &&
    a.delay.enabled === b.delay.enabled &&
    a.delay.time === b.delay.time &&
    a.delay.mix === b.delay.mix &&
    a.reverb.enabled === b.reverb.enabled &&
    a.reverb.mix === b.reverb.mix &&
    a.reverb.decay === b.reverb.decay &&
    (['r', 'g', 'b'] as const).every((c) => colorChannelMatches(a.color[c], b.color[c]))
  )
}

/** Cópia do Set sem `idx` (mesma referência se não estava lá — evita re-render à toa). */
function without(set: Set<number>, idx: number): Set<number> {
  if (!set.has(idx)) return set
  const next = new Set(set)
  next.delete(idx)
  return next
}

interface PresetStore {
  connectionStatus: ConnectionStatus
  /** Porta + modelo/firmware do último handshake; null desconectado. */
  deviceInfo: DeviceInfo | null
  setDeviceInfo: (info: DeviceInfo | null) => void
  setConnectionStatus: (status: ConnectionStatus) => void

  presets: Preset[]
  /** Baseline por slot (última versão salva/carregada, sem edições) — origem do descarte. */
  savedPresets: Preset[]
  setAllPresets: (presets: Preset[]) => void

  currentBank: number
  currentSlot: PresetSlot
  setBank: (bank: number) => void
  setSlot: (slot: PresetSlot) => void

  dirtyIndices: Set<number>
  /** Subconjunto de dirtyIndices cuja diferença veio do PEDAL (knob físico / outro app),
   *  não de edição na UI. Edição na UI tira o slot daqui (vira "modificado"). */
  pedalDirtyIndices: Set<number>
  isDirty: boolean
  isCurrentDirty: boolean
  bypass: boolean

  currentPreset: Preset
  updatePreset: (updates: Partial<Preset>) => void
  updateAmp: (updates: Partial<Preset['amp']>) => void
  updateMod: (updates: Partial<Preset['mod']>) => void
  updateDelay: (updates: Partial<Preset['delay']>) => void
  updateReverb: (updates: Partial<Preset['reverb']>) => void
  markSlotSaved: (index: number) => void
  discardCurrentEdits: () => void
  setBypass: (on: boolean) => void

  applyPending: boolean
  setApplyPending: (pending: boolean) => void
  pedalSyncMutedUntil: number
  mutePedalSync: (ms: number) => void
  awaitingPedalBaseline: boolean
  /** Momento (ms) da última troca de slot feita NO PEDAL — a UI destaca o slot. */
  lastPedalSwitchAt: number
  syncFromPedal: (status: PedalStatus) => void
  syncLivePreset: (preset: Preset) => void

  systemMode: SystemMode
  previousMode: SystemMode
  setSystemMode: (mode: SystemMode) => void
  setPreviousMode: (mode: SystemMode) => void

  syncState: SyncState
  setSyncState: (state: SyncState) => void
  toastMessage: string | null
  toastVariant: ToastVariant
  showToast: (message: string, variant?: ToastVariant) => void
  clearToast: () => void
}

export const usePresetStore = create<PresetStore>((set, get) => ({
  connectionStatus: 'disconnected',
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  deviceInfo: null,
  setDeviceInfo: (deviceInfo) => set({ deviceInfo }),

  presets: generateDefaultPresets(),
  savedPresets: generateDefaultPresets(),
  setAllPresets: (presets) => {
    const state = get()
    const idx = presetIndex(state.currentBank, state.currentSlot)
    const dirtyIndices = new Set<number>()
    // Os presets carregados da flash viram também a baseline de descarte.
    set({ presets, savedPresets: [...presets], currentPreset: presets[idx], dirtyIndices, pedalDirtyIndices: new Set<number>(), isDirty: false, isCurrentDirty: false })
  },

  currentBank: 1,
  currentSlot: 'A',
  setBank: (bank) => {
    const state = get()
    const idx = presetIndex(bank, state.currentSlot)
    const isCurrentDirty = state.dirtyIndices.has(idx)
    // Troca de banco/slot pela UI invalida uma baseline armada por syncFromPedal:
    // a leitura live em trânsito quando o usuário trocou será descartada pelo guard
    // de bank/slot em syncLivePreset, então a flag não pode sobreviver para "engolir"
    // a PRÓXIMA leitura (ex.: knob físico) como se fosse baseline.
    set({ currentBank: bank, currentPreset: state.presets[idx], isCurrentDirty, awaitingPedalBaseline: false })
  },
  setSlot: (slot) => {
    const state = get()
    const idx = presetIndex(state.currentBank, slot)
    const isCurrentDirty = state.dirtyIndices.has(idx)
    // Ver comentário em setBank.
    set({ currentSlot: slot, currentPreset: state.presets[idx], isCurrentDirty, awaitingPedalBaseline: false })
  },

  dirtyIndices: new Set<number>(),
  pedalDirtyIndices: new Set<number>(),
  isDirty: false,
  isCurrentDirty: false,
  bypass: false,

  currentPreset: createDefaultPreset(1, 'A'),

  updatePreset: (updates) => set((state) => {
    const updated = { ...state.currentPreset, ...updates }
    const presets = [...state.presets]
    const idx = presetIndex(state.currentBank, state.currentSlot)
    presets[idx] = updated
    const dirtyIndices = new Set(state.dirtyIndices)
    dirtyIndices.add(idx)
    return { currentPreset: updated, presets, dirtyIndices, pedalDirtyIndices: without(state.pedalDirtyIndices, idx), isDirty: true, isCurrentDirty: true }
  }),

  updateAmp: (updates) => set((state) => {
    const updated = { ...state.currentPreset, amp: { ...state.currentPreset.amp, ...updates } }
    const presets = [...state.presets]
    const idx = presetIndex(state.currentBank, state.currentSlot)
    presets[idx] = updated
    const dirtyIndices = new Set(state.dirtyIndices)
    dirtyIndices.add(idx)
    return { currentPreset: updated, presets, dirtyIndices, pedalDirtyIndices: without(state.pedalDirtyIndices, idx), isDirty: true, isCurrentDirty: true }
  }),

  updateMod: (updates) => set((state) => {
    const updated = { ...state.currentPreset, mod: { ...state.currentPreset.mod, ...updates } }
    const presets = [...state.presets]
    const idx = presetIndex(state.currentBank, state.currentSlot)
    presets[idx] = updated
    const dirtyIndices = new Set(state.dirtyIndices)
    dirtyIndices.add(idx)
    return { currentPreset: updated, presets, dirtyIndices, pedalDirtyIndices: without(state.pedalDirtyIndices, idx), isDirty: true, isCurrentDirty: true }
  }),

  updateDelay: (updates) => set((state) => {
    const updated = { ...state.currentPreset, delay: { ...state.currentPreset.delay, ...updates } }
    const presets = [...state.presets]
    const idx = presetIndex(state.currentBank, state.currentSlot)
    presets[idx] = updated
    const dirtyIndices = new Set(state.dirtyIndices)
    dirtyIndices.add(idx)
    return { currentPreset: updated, presets, dirtyIndices, pedalDirtyIndices: without(state.pedalDirtyIndices, idx), isDirty: true, isCurrentDirty: true }
  }),

  updateReverb: (updates) => set((state) => {
    const updated = { ...state.currentPreset, reverb: { ...state.currentPreset.reverb, ...updates } }
    const presets = [...state.presets]
    const idx = presetIndex(state.currentBank, state.currentSlot)
    presets[idx] = updated
    const dirtyIndices = new Set(state.dirtyIndices)
    dirtyIndices.add(idx)
    return { currentPreset: updated, presets, dirtyIndices, pedalDirtyIndices: without(state.pedalDirtyIndices, idx), isDirty: true, isCurrentDirty: true }
  }),

  markSlotSaved: (index) => {
    const state = get()
    const dirtyIndices = new Set(state.dirtyIndices)
    dirtyIndices.delete(index)
    const currentIdx = presetIndex(state.currentBank, state.currentSlot)
    const savedPresets = [...state.savedPresets]
    savedPresets[index] = state.presets[index] // o que foi gravado vira a nova baseline
    set({
      savedPresets,
      dirtyIndices,
      pedalDirtyIndices: without(state.pedalDirtyIndices, index),
      isDirty: dirtyIndices.size > 0,
      isCurrentDirty: dirtyIndices.has(currentIdx),
    })
  },

  // Descarta as edições não salvas do slot atual, restaurando a baseline (versão
  // salva/carregada). No-op estrito se o slot não estiver sujo.
  discardCurrentEdits: () => {
    const state = get()
    const idx = presetIndex(state.currentBank, state.currentSlot)
    if (!state.dirtyIndices.has(idx)) return
    const saved = state.savedPresets[idx]
    const presets = [...state.presets]
    presets[idx] = saved
    const dirtyIndices = new Set(state.dirtyIndices)
    dirtyIndices.delete(idx)
    set({
      presets,
      currentPreset: saved,
      dirtyIndices,
      pedalDirtyIndices: without(state.pedalDirtyIndices, idx),
      isDirty: dirtyIndices.size > 0,
      isCurrentDirty: false,
    })
  },
  setBypass: (on) => set({ bypass: on }),

  applyPending: false,
  setApplyPending: (applyPending) => set({ applyPending }),
  pedalSyncMutedUntil: 0,
  mutePedalSync: (ms) => set({ pedalSyncMutedUntil: Date.now() + ms }),
  awaitingPedalBaseline: false,
  lastPedalSwitchAt: 0,

  // Espelha o status do pedal (origem: DeviceStateMonitor). Estado igual = no-op
  // estrito. Troca de slot descarta o dirty do slot ENTRADO ("troca no pé mostra a
  // flash") e arma a baseline: a próxima leitura do preset ativo substitui o
  // conteúdo sem marcar dirty.
  syncFromPedal: (status) => {
    const state = get()
    if (Date.now() < state.pedalSyncMutedUntil) return
    const updates: Partial<PresetStore> = {}
    if (status.bypass !== state.bypass) updates.bypass = status.bypass
    if (status.mode !== null && status.mode !== state.systemMode) updates.systemMode = status.mode
    if (status.slotIndex !== null) {
      const bank = status.bankIndex + 1
      const slot = (['A', 'B', 'C', 'D'] as const)[status.slotIndex]
      if (bank !== state.currentBank || slot !== state.currentSlot) {
        const idx = presetIndex(bank, slot)
        const dirtyIndices = new Set(state.dirtyIndices)
        dirtyIndices.delete(idx)
        Object.assign(updates, {
          currentBank: bank,
          currentSlot: slot,
          currentPreset: state.presets[idx],
          dirtyIndices,
          pedalDirtyIndices: without(state.pedalDirtyIndices, idx),
          isDirty: dirtyIndices.size > 0,
          isCurrentDirty: false,
          awaitingPedalBaseline: true,
          lastPedalSwitchAt: Date.now(),
        })
      }
    }
    if (Object.keys(updates).length > 0) set(updates)
  },

  // Espelha o buffer ativo do pedal ("pedal é a verdade"). Baseline pós-troca não
  // suja; mudança espontânea (knob físico) suja. Cores comparadas módulo LSB — a
  // leitura live é 7-bit, o eco de uma cor da UI voltaria com LSB zerado.
  syncLivePreset: (preset) => {
    const state = get()
    if (Date.now() < state.pedalSyncMutedUntil) return
    if (state.applyPending) return
    if (preset.bank !== state.currentBank || preset.slot !== state.currentSlot) return
    if (presetsEquivalent(preset, state.currentPreset)) {
      if (state.awaitingPedalBaseline) set({ awaitingPedalBaseline: false })
      return
    }
    const idx = presetIndex(preset.bank, preset.slot)
    const presets = [...state.presets]
    presets[idx] = preset
    // Pedal voltou a bater com o salvo: se a diferença era só do pedal (nenhuma edição
    // da UI pendente), o slot deixa de estar sujo. Desfaz marcações de leituras transitórias.
    const uiDirty = state.dirtyIndices.has(idx) && !state.pedalDirtyIndices.has(idx)
    if (!state.awaitingPedalBaseline && !uiDirty && presetsEquivalent(preset, state.savedPresets[idx])) {
      const dirtyIndices = without(state.dirtyIndices, idx)
      set({
        presets,
        currentPreset: preset,
        dirtyIndices,
        pedalDirtyIndices: without(state.pedalDirtyIndices, idx),
        isDirty: dirtyIndices.size > 0,
        isCurrentDirty: false,
      })
      return
    }
    if (state.awaitingPedalBaseline) {
      // Baseline vinda da flash do pedal (troca no pé): vira também a baseline de descarte.
      const savedPresets = [...state.savedPresets]
      savedPresets[idx] = preset
      set({ presets, savedPresets, currentPreset: preset, awaitingPedalBaseline: false })
    } else {
      // Se o slot já estava sujo pela UI, segue "modificado"; senão a diferença é do pedal.
      const pedalDirtyIndices = state.dirtyIndices.has(idx) && !state.pedalDirtyIndices.has(idx)
        ? state.pedalDirtyIndices
        : new Set(state.pedalDirtyIndices).add(idx)
      const dirtyIndices = new Set(state.dirtyIndices)
      dirtyIndices.add(idx)
      set({ presets, currentPreset: preset, dirtyIndices, pedalDirtyIndices, isDirty: true, isCurrentDirty: true })
    }
  },

  systemMode: 'normal',
  previousMode: 'normal',
  setSystemMode: (mode) => set({ systemMode: mode }),
  setPreviousMode: (mode) => set({ previousMode: mode }),

  syncState: 'synced',
  setSyncState: (syncState) => set({ syncState }),
  toastMessage: null,
  toastVariant: 'error',
  showToast: (toastMessage, toastVariant = 'error') => set({ toastMessage, toastVariant }),
  clearToast: () => set({ toastMessage: null }),
}))
