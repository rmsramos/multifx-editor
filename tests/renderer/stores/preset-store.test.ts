import { describe, it, expect, beforeEach } from 'vitest'
import { usePresetStore } from '@renderer/stores/preset-store'
import type { PedalStatus } from '@shared/types/device'

// Snapshot pristino capturado no carregamento do módulo, antes de qualquer teste
// mutar o store. `setState(initial, true)` restaura o estado inteiro entre testes.
const initial = usePresetStore.getState()
const status = (over: Partial<PedalStatus> = {}): PedalStatus =>
  ({ bankIndex: 0, slotIndex: 0, mode: 'normal', bypass: false, ...over })

beforeEach(() => usePresetStore.setState(initial, true))

describe('preset-store: sync e toast', () => {
  it('setSyncState atualiza o estado', () => {
    usePresetStore.getState().setSyncState('applying')
    expect(usePresetStore.getState().syncState).toBe('applying')
  })

  it('showToast/clearToast controlam a mensagem', () => {
    usePresetStore.getState().showToast('Sem ACK ao escrever')
    expect(usePresetStore.getState().toastMessage).toBe('Sem ACK ao escrever')
    usePresetStore.getState().clearToast()
    expect(usePresetStore.getState().toastMessage).toBeNull()
  })
})

describe('discardCurrentEdits', () => {
  it('restaura a baseline do slot atual e limpa o dirty', () => {
    const s = usePresetStore.getState()
    s.updateAmp({ gain: 99 })                          // edita 1A (baseline gain = 64)
    expect(usePresetStore.getState().currentPreset.amp.gain).toBe(99)
    expect(usePresetStore.getState().isCurrentDirty).toBe(true)
    usePresetStore.getState().discardCurrentEdits()
    const after = usePresetStore.getState()
    expect(after.currentPreset.amp.gain).toBe(64)      // voltou à baseline
    expect(after.isCurrentDirty).toBe(false)
    expect(after.dirtyIndices.has(0)).toBe(false)
  })

  it('é no-op quando o slot atual não está modificado', () => {
    const before = usePresetStore.getState().presets
    usePresetStore.getState().discardCurrentEdits()
    expect(usePresetStore.getState().presets).toBe(before) // nenhuma mutação
  })

  it('descarta só o slot atual, preservando o dirty de outros slots', () => {
    const s = usePresetStore.getState()
    s.updateAmp({ gain: 99 })                          // 1A dirty
    s.setSlot('B'); s.updateAmp({ gain: 88 })          // 1B dirty
    s.setSlot('A')                                     // volta a 1A
    usePresetStore.getState().discardCurrentEdits()    // descarta só 1A
    const after = usePresetStore.getState()
    expect(after.dirtyIndices.has(0)).toBe(false)      // 1A limpo
    expect(after.dirtyIndices.has(1)).toBe(true)       // 1B ainda sujo
  })

  it('após salvar, o descarte volta à versão salva (não à de fábrica)', () => {
    const s = usePresetStore.getState()
    s.updateAmp({ gain: 99 })
    s.markSlotSaved(0)                                 // 99 vira a nova baseline
    s.updateAmp({ gain: 30 })                          // edita de novo
    usePresetStore.getState().discardCurrentEdits()
    expect(usePresetStore.getState().currentPreset.amp.gain).toBe(99) // versão salva, não 64
  })
})

describe('syncFromPedal', () => {
  it('troca banco/slot local e descarta o dirty do slot que entrou', () => {
    const s = usePresetStore.getState()
    s.setBank(2); s.setSlot('B')                      // usuário está em 2B
    s.updateAmp({ gain: 99 })                          // edição pendente em 2B...
    s.setBank(1); s.setSlot('A')                       // ...e volta para 1A
    usePresetStore.getState().syncFromPedal(status({ bankIndex: 1, slotIndex: 1 })) // pé foi para 2B
    const after = usePresetStore.getState()
    expect(after.currentBank).toBe(2)
    expect(after.currentSlot).toBe('B')
    expect(after.dirtyIndices.has(5)).toBe(false)      // 2B (idx 5): dirty descartado
    expect(after.awaitingPedalBaseline).toBe(true)     // próxima leitura live é baseline
  })

  it('estado igual é no-op estrito (nenhuma mutação)', () => {
    const before = usePresetStore.getState()
    before.syncFromPedal(status())                     // 1A normal = estado inicial
    expect(usePresetStore.getState().presets).toBe(before.presets)
  })

  it('bypass do pedal liga o indicador sem tocar banco/slot', () => {
    usePresetStore.getState().syncFromPedal(status({ slotIndex: null, mode: null, bypass: true }))
    const after = usePresetStore.getState()
    expect(after.bypass).toBe(true)
    expect(after.currentBank).toBe(1)
  })

  it('respeita a janela de mute (pós-ação da UI)', () => {
    usePresetStore.getState().mutePedalSync(1500)
    usePresetStore.getState().syncFromPedal(status({ bankIndex: 3, slotIndex: 2 }))
    expect(usePresetStore.getState().currentBank).toBe(1) // ignorado
  })
})

describe('syncLivePreset', () => {
  it('knob físico: substitui valores e marca dirty', () => {
    const preset = { ...usePresetStore.getState().currentPreset, amp: { ...usePresetStore.getState().currentPreset.amp, gain: 42 } }
    usePresetStore.getState().syncLivePreset(preset)
    const after = usePresetStore.getState()
    expect(after.currentPreset.amp.gain).toBe(42)
    expect(after.isCurrentDirty).toBe(true)
  })

  it('baseline pós-troca: substitui SEM marcar dirty e limpa a flag', () => {
    usePresetStore.setState({ awaitingPedalBaseline: true })
    const preset = { ...usePresetStore.getState().currentPreset, amp: { ...usePresetStore.getState().currentPreset.amp, gain: 7 } }
    usePresetStore.getState().syncLivePreset(preset)
    const after = usePresetStore.getState()
    expect(after.currentPreset.amp.gain).toBe(7)
    expect(after.isCurrentDirty).toBe(false)
    expect(after.awaitingPedalBaseline).toBe(false)
  })

  it('conteúdo equivalente é no-op (cores comparadas módulo LSB)', () => {
    const cur = usePresetStore.getState().currentPreset
    const echoed = { ...cur, color: { r: cur.color.r & 0xfe, g: cur.color.g & 0xfe, b: cur.color.b & 0xfe } }
    const before = usePresetStore.getState().presets
    usePresetStore.getState().syncLivePreset(echoed)
    expect(usePresetStore.getState().presets).toBe(before)
    expect(usePresetStore.getState().isCurrentDirty).toBe(false)
  })

  it('descarta leitura de slot que não é o atual (evento velho em trânsito)', () => {
    const stale = { ...usePresetStore.getState().currentPreset, bank: 9, slot: 'D' as const, irCab: 5 }
    usePresetStore.getState().syncLivePreset(stale)
    expect(usePresetStore.getState().currentPreset.irCab).not.toBe(5)
  })

  it('descarta com applyPending (estado da UI é mais novo que a leitura)', () => {
    usePresetStore.setState({ applyPending: true })
    const preset = { ...usePresetStore.getState().currentPreset, noiseGate: 88 }
    usePresetStore.getState().syncLivePreset(preset)
    expect(usePresetStore.getState().currentPreset.noiseGate).not.toBe(88)
  })

  it('equivalência é independente da ordem de chaves (shape do decodePreset vs shape do store)', () => {
    // decodePreset (main/protocol/preset-codec.ts) monta o objeto na ordem
    // bank, slot, noiseGate, reverb, delay, mod, amp, irCab, color — diferente
    // da ordem usada por createDefaultPreset/updates no store. Um "eco" do pedal
    // com os MESMOS valores mas nessa ordem de chaves não pode ser tratado como
    // mudança (regressão: JSON.stringify de objetos com ordens diferentes gera
    // strings diferentes mesmo com conteúdo idêntico).
    const cur = usePresetStore.getState().currentPreset
    const echo = {
      bank: cur.bank,
      slot: cur.slot,
      noiseGate: cur.noiseGate,
      reverb: { enabled: cur.reverb.enabled, mix: cur.reverb.mix, decay: cur.reverb.decay },
      delay: { enabled: cur.delay.enabled, time: cur.delay.time, mix: cur.delay.mix },
      mod: { enabled: cur.mod.enabled, fx: cur.mod.fx, speed: cur.mod.speed },
      amp: {
        enabled: cur.amp.enabled,
        type: cur.amp.type,
        gain: cur.amp.gain,
        treble: cur.amp.treble,
        middle: cur.amp.middle,
        bass: cur.amp.bass,
        volume: cur.amp.volume,
      },
      irCab: cur.irCab,
      color: { r: cur.color.r & 0xfe, g: cur.color.g & 0xfe, b: cur.color.b & 0xfe },
    }
    const beforePresets = usePresetStore.getState().presets
    const beforePreset = usePresetStore.getState().currentPreset
    usePresetStore.getState().syncLivePreset(echo)
    const after = usePresetStore.getState()
    expect(after.presets).toBe(beforePresets)
    expect(after.currentPreset).toBe(beforePreset)
    expect(after.isCurrentDirty).toBe(false)
  })
})

describe('setBank/setSlot desarmam awaitingPedalBaseline', () => {
  it('troca de slot pela UI após troca via pedal descarma a baseline; a leitura live seguinte marca dirty', () => {
    // Pé troca para 2B: arma a baseline (leitura live seguinte seria tratada como não-dirty).
    usePresetStore.getState().syncFromPedal(status({ bankIndex: 1, slotIndex: 1 }))
    expect(usePresetStore.getState().awaitingPedalBaseline).toBe(true)

    // Usuário troca para 2C pela UI antes da leitura live chegar: o guard de
    // bank/slot em syncLivePreset descartaria essa leitura em trânsito, então a
    // flag não pode sobreviver — senão engoliria a PRÓXIMA leitura (knob físico).
    usePresetStore.getState().setSlot('C')
    expect(usePresetStore.getState().awaitingPedalBaseline).toBe(false)

    const cur = usePresetStore.getState().currentPreset // 2C
    const preset = { ...cur, amp: { ...cur.amp, gain: 111 } }
    usePresetStore.getState().syncLivePreset(preset)
    const after = usePresetStore.getState()
    expect(after.currentPreset.amp.gain).toBe(111)
    expect(after.isCurrentDirty).toBe(true)
  })
})

describe('origem do dirty: pedal × UI', () => {
  const withGain = (gain: number) => {
    const p = usePresetStore.getState().currentPreset
    return { ...p, amp: { ...p.amp, gain } }
  }

  it('mudança vinda do pedal marca o slot em pedalDirtyIndices', () => {
    usePresetStore.getState().syncLivePreset(withGain(42))
    const s = usePresetStore.getState()
    expect(s.dirtyIndices.has(0)).toBe(true)
    expect(s.pedalDirtyIndices.has(0)).toBe(true)
  })

  it('edição na UI depois tira a origem pedal (vira "modificado")', () => {
    usePresetStore.getState().syncLivePreset(withGain(42))
    usePresetStore.getState().updateAmp({ gain: 10 })
    expect(usePresetStore.getState().pedalDirtyIndices.has(0)).toBe(false)
    expect(usePresetStore.getState().dirtyIndices.has(0)).toBe(true)
  })

  it('slot já editado na UI continua "modificado" mesmo se o pedal mudar algo', () => {
    usePresetStore.getState().updateAmp({ gain: 10 })
    usePresetStore.getState().syncLivePreset(withGain(55))
    expect(usePresetStore.getState().pedalDirtyIndices.has(0)).toBe(false)
  })

  it('descartar e salvar limpam a origem pedal', () => {
    usePresetStore.getState().syncLivePreset(withGain(42))
    usePresetStore.getState().discardCurrentEdits()
    expect(usePresetStore.getState().pedalDirtyIndices.has(0)).toBe(false)
    usePresetStore.getState().syncLivePreset(withGain(43))
    usePresetStore.getState().markSlotSaved(0)
    expect(usePresetStore.getState().pedalDirtyIndices.has(0)).toBe(false)
  })
})

describe('leitura transitória durante a troca não deixa o slot sujo', () => {
  it('pedal diverge e depois volta a bater com o salvo → slot limpo', () => {
    const saved = usePresetStore.getState().currentPreset
    usePresetStore.getState().syncLivePreset({ ...saved, amp: { ...saved.amp, gain: 3 } }) // buffer no meio da carga
    expect(usePresetStore.getState().isCurrentDirty).toBe(true)
    usePresetStore.getState().syncLivePreset(saved) // leitura seguinte, correta
    const s = usePresetStore.getState()
    expect(s.isCurrentDirty).toBe(false)
    expect(s.dirtyIndices.has(0)).toBe(false)
    expect(s.pedalDirtyIndices.has(0)).toBe(false)
    expect(s.currentPreset.amp.gain).toBe(saved.amp.gain)
  })

  it('edição da UI ainda não aplicada NÃO é apagada por leitura igual ao salvo', () => {
    const saved = usePresetStore.getState().currentPreset
    usePresetStore.getState().updateAmp({ gain: 10 })
    usePresetStore.getState().syncLivePreset(saved)
    expect(usePresetStore.getState().isCurrentDirty).toBe(true)
  })
})

describe('cor do buffer ao vivo: 8 bits (troca) e 7 bits (eco da escrita)', () => {
  const withColor = (r: number, g: number, b: number) => ({ ...usePresetStore.getState().currentPreset, color: { r, g, b } })

  it('cor de 8 bits igual à salva (troca de preset) não suja o slot', () => {
    usePresetStore.setState({ currentPreset: withColor(255, 170, 255) })
    usePresetStore.getState().syncLivePreset(withColor(255, 170, 255))
    expect(usePresetStore.getState().isCurrentDirty).toBe(false)
  })

  it('eco em 7 bits da nossa escrita (value>>1) não suja o slot', () => {
    usePresetStore.setState({ currentPreset: withColor(255, 170, 255) })
    usePresetStore.getState().syncLivePreset(withColor(127, 85, 127))
    expect(usePresetStore.getState().isCurrentDirty).toBe(false)
  })

  it('cor realmente diferente suja o slot', () => {
    usePresetStore.setState({ currentPreset: withColor(255, 170, 255) })
    usePresetStore.getState().syncLivePreset(withColor(10, 200, 30))
    expect(usePresetStore.getState().isCurrentDirty).toBe(true)
  })
})

