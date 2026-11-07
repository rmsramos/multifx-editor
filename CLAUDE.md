# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

MultiFX Editor: aplicação desktop Electron para configurar o pedal M-VAVE Tank G via USB MIDI no Linux (alternativa open-source ao M-EFCS, que não suporta Linux). Não afiliado à M-VAVE; "Tank G" e "M-VAVE" são citados apenas como referência de compatibilidade (uso nominativo).

## Idioma

Toda comunicação deve ser feita em pt_BR (português do Brasil).

## Stack

- **Electron** com electron-vite (build tooling)
- **React + TypeScript** no renderer process
- **TailwindCSS v4** para styling (configuração em `src/renderer/styles/globals.css`)
- **Zustand** para gerenciamento de estado
- **Vitest** + Testing Library para testes
- **ALSA rawmidi via `amidi`** (alsa-utils) no main process para comunicação com o pedal (`src/main/transport/alsa-midi-transport.ts`)
- **Protocolo SysEx** proprietário M-VAVE (manufacturer ID `00 32`)

## Arquitetura

4 camadas:
- **Transport** (`src/main/transport/`): interface `Transport` e implementação ALSA que roda `amidi` para enviar/receber SysEx
- **Protocol** (`src/main/protocol/`): encode/decode SysEx M-VAVE (`mvave-codec.ts`), packing Jieli 7↔8 bits (`jieli-pack.ts`), codec de preset (`preset-codec.ts`)
- **Services** (`src/main/services/`): presets, fila de escrita de parâmetros, monitor de estado do pedal
- **UI** (`src/renderer/`): componentes React, stores Zustand, i18n; comunicação com o main via IPC (contextBridge em `src/preload/index.ts`)

Protocolo documentado em `docs/protocol/` (observações de engenharia reversa; hipóteses marcadas como tal).

## Comandos

```bash
npm install          # Instalar dependências
npm run dev          # Desenvolvimento (Electron + Vite HMR; editar src/main exige reiniciar)
npm run build        # Build de produção
npm run build:linux  # Build + empacotamento Linux (electron-builder)
npm run start        # Preview do build
npm run test         # Rodar todos os testes (vitest run)
npm run test:watch   # Testes em modo watch
```

## Estrutura do Projeto

```
src/
  main/
    index.ts                      # Entry point do main process
    ipc/handlers.ts               # IPC handlers (main <-> renderer)
    protocol/
      jieli-pack.ts               # Packing Jieli 7<->8 bits
      mvave-codec.ts              # Frames SysEx M-VAVE
      preset-codec.ts             # Serialização de presets
    services/
      device-state-monitor.ts     # Poll de status do pedal (região 0x42)
      param-write-queue.ts        # Fila de escrita de parâmetros ao vivo
      preset-service.ts           # Lógica de presets, import/export
    transport/
      transport.ts                # Interface de transporte
      alsa-midi-transport.ts      # Transporte ALSA rawmidi via amidi
  preload/index.ts                # contextBridge (window API)
  renderer/
    App.tsx, main.tsx, theme.ts, env.d.ts, index.html
    components/                   # Componentes UI, um por arquivo (módulos de efeito, Knob, Toggle, PresetGrid, LedPicker, ...)
    hooks/                        # useDevice.ts, usePreset.ts
    i18n/index.ts                 # Hook de tradução do renderer
    stores/                       # preset-store.ts, settings-store.ts
    styles/globals.css            # TailwindCSS globals
  shared/
    block-param.ts, constants.ts, ipc-channels.ts
    i18n/                         # Catálogos en.ts e pt-BR.ts, index.ts
    types/                        # preset.ts, device.ts
scripts/                          # CLI (multifx-cli.mjs), decodificadores de captura, setup-udev.sh
tests/                            # main/, shared/, renderer/, scripts/
docs/protocol/                    # Documentação do protocolo (engenharia reversa)
```

## Device: M-VAVE Tank G

- 36 presets editáveis (9 banks x 4 presets A/B/C/D)
- Signal chain: Noise Gate -> AMP (9 tipos) -> MOD (Chorus/Phaser/Tremolo) -> Delay (Analog/Tape/Dual) -> Reverb (Room/Spring/Cloud) -> IR CAB (9 slots)
- Parâmetros: valores 0-127

## Convenções

- Código-fonte e nomes de variáveis/funções em inglês
- Commits, docs e comunicação em pt_BR
- Componentes React: PascalCase, um componente por arquivo
- Hooks: prefixo `use` (useDevice, usePreset)
- Store Zustand em `src/renderer/stores/`
- Tipos compartilhados em `src/shared/types/`
- Textos de UI nos catálogos `src/shared/i18n/` (en e pt-BR, mesmas chaves)
- Nada de " — " (travessão com espaços) em textos; usar pontuação correta

## Linux

- Requer `alsa-utils` (`amidi`) e o usuário no grupo `audio`
- `scripts/setup-udev.sh` é opcional (regra udev para quem não está no grupo `audio`)
- Testar detecção: `amidi -l`

## Material de engenharia reversa (privado)

Fica em `private/` (uma pasta privada fora do repositório, acessível pelo symlink `private/`, ignorado pelo git): `apk/`, `captures/`, `experiments/`, `docs-internos/`. Nunca copiar nada de lá para o repositório.

## Ferramentas MCP — Obrigatório

### Serena MCP (análise e edição de código)
**SEMPRE usar Serena como ferramenta primária** para trabalhar com código:
- `get_symbols_overview` — entender estrutura de um arquivo antes de editá-lo
- `find_symbol` — localizar classes, funções, interfaces por nome
- `find_referencing_symbols` — encontrar quem usa um símbolo (para refactoring seguro)
- `search_for_pattern` — busca de padrões no código
- `replace_symbol_body` — editar corpo de funções/classes com precisão
- `insert_before_symbol` / `insert_after_symbol` — adicionar código em posição exata
- `list_memories` / `read_memory` / `write_memory` — consultar e manter memórias do projeto

**Configuração**: `.serena/project.yml` (linguagem: typescript)

### Fluxo de trabalho com MCPs
1. **Antes de explorar código**: usar Serena (`get_symbols_overview`, `find_symbol`) para navegação simbólica eficiente
2. **Antes de editar**: usar Serena para entender dependências (`find_referencing_symbols`)
3. **Ao editar**: preferir edições simbólicas do Serena (`replace_symbol_body`) quando possível
4. **Ao completar tarefa**: atualizar memórias do Serena se houve mudança arquitetural
5. **Skills superpowers**: integrar com Serena para análise, brainstorming e code review
