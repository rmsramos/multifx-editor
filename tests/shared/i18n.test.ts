import { describe, it, expect } from 'vitest'
import { translate } from '@shared/i18n'
import { en } from '@shared/i18n/en'
import { ptBR } from '@shared/i18n/pt-BR'

describe('i18n: translate', () => {
  it('traduz uma chave simples em inglês e português', () => {
    expect(translate('en', 'toolbar.save')).toBe('Save to pedal')
    expect(translate('pt-BR', 'toolbar.save')).toBe('Salvar no pedal')
  })

  it('interpola parâmetros na mensagem', () => {
    expect(translate('en', 'toast.presetSaved', { slot: '3B' })).toBe('Preset 3B saved to the pedal')
  })

  it('mantém o placeholder literal se o parâmetro não for informado (sem lançar erro)', () => {
    expect(() => translate('en', 'toast.presetSaved')).not.toThrow()
    expect(translate('en', 'toast.presetSaved')).toBe('Preset {slot} saved to the pedal')
  })

  it('en e pt-BR cobrem exatamente as mesmas chaves', () => {
    expect(Object.keys(ptBR).sort()).toEqual(Object.keys(en).sort())
  })
})

describe('i18n catalogs', () => {
  it('have the same keys', () => expect(Object.keys(ptBR).sort()).toEqual(Object.keys(en).sort()))
  it('carry the non-affiliation notice', () => {
    expect(en['app.disclaimer']).toMatch(/not affiliated/i)
    expect(en['app.disclaimer']).toContain('M-VAVE')
    expect(ptBR['app.disclaimer']).toMatch(/não é afiliado/i)
  })
  it('warn about flash writes on the save button', () => {
    expect(en['toolbar.saveTitle']).toMatch(/overwrit/i)
    expect(ptBR['toolbar.saveTitle']).toMatch(/sobrescreve/i)
  })
})
