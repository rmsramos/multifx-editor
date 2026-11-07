# Protocolo OTA do Tank G — Fase 1 (observação do M-UPGRADE)

> Documento de engenharia reversa para interoperabilidade. Protocolo observado no tráfego MIDI entre o app oficial e o pedal; nenhum conteúdo do app ou do firmware é reproduzido aqui.

> **Escopo:** engenharia reversa **passiva** (sem regravar o pedal) do app oficial de firmware da
> M-Vave. Todas as afirmações abaixo têm fonte (log, captura, string de binário ou o próprio `.fwsc`).
> O que é suposição está marcado como **[Fase 2]**. Ver a regra deste documento: só afirmar o que foi observado.
>
> Observado em 2026-07-06. Pedal físico: `TANK-Gv2`. App: `M-UPGRADE` (M-UPGRADE.zip).

## Resumo

O `M-UPGRADE` é o aplicativo **genérico** de atualização de firmware da M-Vave/Sinco (o mesmo
binário atende MK300, FM-1, FX-120, URM-1000 e Tank G — identifica o modelo pelo handshake MIDI).
É Qt6 + **RtMidi (WinMM)**; a comunicação é **100% MIDI/SysEx** (sem WinUSB/libusb/HID). Roda no
Linux via **Docker + Wine** — foi confirmado ao vivo detectando o pedal.

## Ambiente de observação (reproduzível)

- Script: script local de container Docker+Wine, não versionado (imagem `scottyhardy/docker-wine`,
  monta o app em `/app`, `--device /dev/snd`, `--device /dev/dri`, X11).
- **GUI:** exige liberar o X para o container — `xhost +local:` no host (o entrypoint do
  scottyhardy que faria isso é sobrescrito). Sem isso o app roda *headless* (detecta o pedal e
  loga, mas a janela não aparece).
- Device USB: `4c4a:c755` **Jieli Technology** — bus 1 / dev 8 no host; porta ALSA `hw:4,0,0`
  ("USB Composite Device MIDI 1").
- Logs do app (evidência primária): `/app/LOG/ota_upgrade_*.log` e `/app/LOG/app_log.txt`.

## Detecção / handshake  — CONFIRMADO (captura usbmon + amidi, byte a byte)

O app escaneia as portas MIDI e faz um **"handshake query"** (probe, timeout 1000 ms) em cada uma;
o alvo é reconhecido pela resposta. Bytes reais capturados:

```
TX (app → pedal):  f0 00 32 45 00 00 00 40 7f f7            ← discovery "45" (idêntico ao do M-EFCS)
RX (pedal → app):  f0 00 32 45 58 01 00 00 2a 41 1c 2d 6a 72 48 1d 19 5f 60 64 31 03
                   00 00 … 00 60 2d f7                       ← resposta "45 58" (nome+versão)
```

- O app deriva **nome + versão** dessa resposta → o app informa nas mensagens de log que se conectou ao dispositivo `TANK-Gv2`, versão 96.
- O byte `0x60` (= 96) aparece na resposta; o mapeamento fino dos campos (qual byte é a versão, como
  o nome "TANK-Gv2" é derivado) **[Fase 2]** — o payload resistiu a ASCII direto e a `unpackJieli`.

## Formato do arquivo `.fwsc` — PARCIAL

Amostra: `TANK-Gv2.fwsc` (520212 bytes, firmware v97). Ferramenta: `scripts/decode-fwsc.mjs`.

- **Footer magic** ASCII **`JLUFW`** (Jieli Upgrade FirmWare) em `0x7f004`, seguido de 11 bytes de
  padding no fim do arquivo. CONFIRMADO.
- **Entropia ≈ 7.99 bits/byte** → o conteúdo é **cifrado ou comprimido** (medida rigorosa; os picos
  visuais de `ff`/`00` enganam, mas não baixam a entropia). Decifrar/descomprimir o payload **[Fase 2]**.
- **Name/Version não estão em ASCII claro** no arquivo (nem sob XOR-constante, bit-reverse ou
  unpack-MIDI). O app os extrai de um header codificado — formato **[Fase 2]**.
- Há dois layouts de parse no app: um em que o log informa o arquivo OTA lido com 20 slots (ex.: FM-1) e um
  em que informa o arquivo OTA lido sem essa indicação (Tank G) → variação de header por modelo. **[Fase 2]**

## Fluxo de atualização — CONFIRMADO (logs) / detalhes do Tank G [Fase 2]

Dois passos (dos `ota_upgrade_*.log`):

1. **First step (verification):** um comando põe o pedal em **modo OTA/bootloader**; ele **reenumera
   com o nome trocado para `ota-<NOME>`** (ex.: `ota-FM-1`). O app valida o nome do `.fwsc` contra o
   device (flag `skipNameCheck`; passa a 1 após entrar em OTA).
2. **Second step (upgrade):** escreve o firmware — protocolo de flash (`FlashType: 0`):
   - blocos de **512 bytes** por endereço (o log registra o envio de dados ao dispositivo, com o endereço e o comprimento de 512),
     endereços decrescentes;
   - blocos menores para vetores/config (`0x00000100` len 10; outros len 16/32);
   - **commit** final em `Address: 0xf0000000, Length: 8` → o log registra a conclusão da atualização.
   - Device reinicia já com a nova versão.

> Os valores acima vêm do app_log agregado (FM-1/MK300/URM-1000). Os endereços/tamanho **específicos
> do Tank G** só saem de uma captura da regravação real. **[Fase 2]**

## Mensagens/validações do app (strings do binário)

O app mostra nome e versão do dispositivo ao conectar, recusa gravar o mesmo firmware que já está
instalado (verificação de versão), recusa dados OTA inválidos, exige um firmware selecionado e válido e
exige que o caminho do recurso de firmware esteja configurado.

Na tela, o botão **`Update Firmware` só habilita** após um firmware válido ser selecionado
(fica cinza até lá) — salvaguarda natural observada em 2026-07-06.

## Descobertas notáveis

- **O M-UPGRADE roda no Docker+Wine e detecta o pedal** (confirmado na GUI e nos logs). O caminho
  Linux para a atualização é, portanto, viável em princípio — falta validar a regravação real.
- **Pedal na v96 — que ERA a versão oficial mais recente em 2026-07-06** (página de downloads da
  M-VAVE, lançada 2024-12-31). **Desatualizado:** ver a seção *Atualização 2026-11-02* — hoje há v97 e v98. O pedal já está atualizado; **não há upgrade oficial pendente**. O `.fwsc` baixado
  pelo usuário também é v96 (confirmado pelo parse do M-UPGRADE, que registra o arquivo OTA lido com versão 96).
  A "v97" só existe embutida no `M-UPGRADE-NTFS.exe` de um tester — **beta não-oficial**, não lançado.

## Confirmado × Fase 2

| Item | Status |
|------|--------|
| App roda no Docker+Wine e detecta o pedal | ✅ Confirmado (tela + logs) |
| Handshake = discovery `45` → resposta `45 58` | ✅ Confirmado (usbmon + amidi) |
| Comunicação 100% MIDI/SysEx (sem USB bruto) | ✅ Confirmado (strings do binário) |
| `.fwsc` tem footer magic `JLUFW` | ✅ Confirmado |
| `.fwsc` payload é cifrado/comprimido (entropia ~8) | ✅ Confirmado |
| Fluxo 2-passos + protocolo de flash (512B, commit `0xf0000000`) | ✅ Confirmado (logs) |
| Onde/como Name+Version estão codificados (resposta `45 58` e header `.fwsc`) | 🔶 Fase 2 |
| Comando exato de entrar em OTA + reenumeração `ota-*` no Wine | 🔶 Fase 2 |
| Decodificar/descomprimir o payload do `.fwsc` | 🔶 Fase 2 |
| Endereços/tamanho de flash específicos do Tank G | 🔶 Fase 2 |
| Viabilidade da regravação completa via Wine (sem brick) | 🔶 Fase 2 |

## Fase 2a — execução (2026-07-06): não houve regravação

Tentamos atualizar via M-UPGRADE, mas concluímos que **não há atualização a aplicar**:
- **v96 era a versão oficial mais recente em 2026-07-06** (M-VAVE downloads, 2024-12-31); o pedal já estava nela.
  (Superado em 2026-11-02 — ver seção abaixo.)
- O `.fwsc` baixado é v96 (parse do M-UPGRADE), então seria um reflash v96→v96 sem ganho.
- Decisão do usuário: **não regravar** — buscar um firmware oficial mais novo se/quando existir.

Feito nesta fase (sem tocar no firmware):
- Firmware alvo validado (`decode-fwsc.mjs`: footer `JLUFW` OK).
- `jl-uboot-tool` preparado; **dump preventivo requer hardware** (dongle `0x16EF`) — não viável por
  software sem abrir o pedal (notas locais, fora do git).
- **Backup dos 36 presets** feito via M-EFCS *Export all presets* → cópia local fora do git
  (758 B = `a5 5a` + 36×21; restaurável via *Import all presets* ou o `preset-codec` do projeto).
- Handshake do M-UPGRADE reconfirmado (discovery `45`).

## Próximos passos (quando houver firmware novo oficial)

Capturar uma **regravação real** (com `usbmon`, ciente da reenumeração `ota-*`) para obter o comando
de entrada em OTA, os bytes SysEx do flash do Tank G, e validar se o Wine completa o processo. Em
paralelo, decodificar o header/payload do `.fwsc` (formato Jieli `JLUFW`). Só então avaliar portar a
atualização para o MultiFX Editor. **Alternativa** para obter o protocolo sem esperar: reflashar a
v96 sobre a v96 (mesmo firmware) só para capturar — risco de brick sem ganho de versão.

## Atualização 2026-11-02 — há firmware novo (v97, v98) e o M-EFCS virou Flutter

Verificado na página oficial de downloads (`https://www.m-vave.com/download`) e no release note
oficial do **TANK-Gv2** (`…/software/releaseNote/firmware/TANK-GV2.txt`, cópia local fora do git).
Atenção: o site lista TANK-G e **TANK-Gv2** como produtos separados, cada um com seu `.fwsc`. O
pedal se identifica como `TANK-Gv2`, então só os arquivos `TANK-Gv2.fwsc` servem:

| Versão | Data | Conteúdo (release note oficial, resumido) |
|--------|------|--------------------------------------------|
| v96 | 2024-12-31 | Versão do pedal do usuário. NATEC noise reduction, AM3. |
| v97 | 2026-01-31 | Suporte a arquivos **AM4** no módulo AMP. |
| **v98** | **2026-10-27** | **Modelos NAM e NAN** (importar/ouvir/salvar via M-EFCS; NAM precisa ser convertido no app). Chorus/phaser/tremolo/delay/reverb reescritos com **estéreo**. Noise gate e **curvas dos knobs** atualizados. Aviso: fazer backup dos presets antes. |

- Arquivo v98 correto: `TANK-Gv2.fwsc` (529 460 B, sha256 `9cecb69e…10f0c2a`), footer `JLUFW` OK
  (`decode-fwsc.mjs`). Cópia local fora do git.
  (Num primeiro momento foi baixado o `TANK-G.fwsc`, do modelo v1, sha256 `1aab3215…830d8`. Ele fica
  isolado numa cópia local fora do git e não deve ser usado neste pedal.)
- **Cópia da v96 (instalada hoje):** cópia local fora do git (520 212 B, sha256
  `e45a5eb2…22a55b53`), baixada em 2026-07-05 e lida pelo M-UPGRADE como "TANK-Gv2, Version 96". O site
  só oferece a versão mais recente de cada modelo, então esta é a única cópia da v96 para um eventual retorno.
- **Impacto para o MultiFX Editor:** v98 muda curvas de knobs e efeitos (estéreo) — a correspondência
  valor↔som que validamos é da v96. O layout dos presets de fábrica **não mudou**: o novo M-EFCS traz
  `tankG_am3_preset.bin` (idêntico byte a byte ao arquivo de presets de fábrica do app Android) e `tankG_am4_preset.bin`
  (758 B, mesmo frame `a5 5a` + 36×21, valores diferentes — decodifica com o codec do projeto: 9 amps/9 mods/9 cabs).
  Os binários `tankG_am4_ampCab.bin` (212 992 B, header ASCII `AM4` + `1J120_CL`) são os modelos de
  amp/cab; confirmam o nome `1J120_CL` já adotado nas constantes.
- **Decisão em aberto:** atualizar v96→v98 pelo M-UPGRADE (observando com `usbmon`, Fase 2a)
  ou permanecer na v96.

### M-EFCS 3.10.2311 (2026-10-23) — reescrita em Flutter

O app desktop oficial deixou de ser Qt6 (`M-EFCS.exe` V2.03.04, mar/2026, ainda disponível como versão Qt em
instalador oficial) e passou a ser **Flutter Windows** (`m_efcs.exe` + `flutter_windows.dll`,
`data/app.so`, versão `3.10.2311`), obtido pelo usuário no site da M-VAVE.
Novidades relevantes: `onnxruntime.dll` (modelos NAM), `ffmpeg` + `stemsep_api.dll` (separador de áudio),
integração TONE3000, `universal_ble_plugin.dll` (BLE), `device_manager_plugin.dll` (USB/MIDI),
`mefcs_ks_bridge.exe` (áudio Kernel Streaming), e os mesmos recursos `flutter_assets` do app Android
(`lib/resources/bin/<modelo>/…`) — o desktop e o mobile agora compartilham código Dart.

Para rodar no Wine 11 (Docker) foram necessários dois ajustes, ambos nesse script local (não versionado):
1. **GPU no container** (`--device /dev/dri`): sem ela o Flutter (D3D11/ANGLE → wined3d) mostra janela preta.
2. **Plugin Bluetooth neutralizado:** no Wine, o plugin Bluetooth do app oficial precisou ser neutralizado por um stub local para o app abrir; o desktop fala com o pedal por USB-MIDI, então nada se perde.

Resultado: app abre na tela *Connect → "Waiting for USB devices…"*. Detecção do pedal com o novo app
**ainda não testada** (pedal não estava conectado em 2026-11-02).

## Pesquisa 2026-11-02: como atualizar para a v98 com segurança a partir do Linux

**M-UPGRADE atual (3.10.2015, 2026-10-20) é Flutter + `upgrade_core.exe`.**
- Detecta o pedal **só por Kernel Streaming** (`ks-scan`), sem alternativa WinMM. No Wine (Docker) o log
  registra zero dispositivos compatíveis encontrados, para sempre (observado). Pelo Wine, o app novo é inviável, e também
  não oferece risco: nunca chega a falar com o pedal.
- O núcleo aceita dois tipos de carregador: se nenhum carregador OTA-MIDI ou HID aparece em 45 segundos, o app desiste (timeout de busca do dispositivo).
  Quem decide é o pedal.

**O Tank G é a mesma plataforma do M-VAVE FM-1** (mesma identidade USB `4c4a:c755`, mesmo discovery
`F0 00 32 45 00 00 00 40 7F F7` → `45 58`). A comunidade do FM-1 documentou o fluxo
([AL-255/FM-1-RE](https://github.com/AL-255/FM-1-RE/blob/main/docs/io/11-ota-protocol.md),
[aroum/fm1-custom-fw](https://github.com/aroum/fm1-custom-fw)):
1. Host manda `F0 22 24 35 7F F7`; o **pedal puxa** o arquivo (read requests) e **verifica antes de gravar**.
2. Passou na verificação: grava um registro de boot e reinicia no carregador OTA, que reaparece com **outra
   identidade USB**: `4d4a:4155` ("ota-FM-1"; note o fabricante `4D4A`).
3. Host repete handshake e comando; o pedal puxa a imagem toda; termina pedindo `0xF0000000` (8 bytes) e o
   host responde `"success\0"`.
- Rede de segurança do chip Jieli: com firmware corrompido, a ROM cai sozinha num modo de recuperação USB
  (no FM-1: `4c4a:8057`, armazenamento em massa) acessível pelo `jl-uboot-tool` no Linux. **Mas** restaurar
  exige uma imagem crua da flash, que não temos (a cópia preventiva exige o dongle, ver Fase 2a).
- Os próprios pesquisadores avisam: retomada após interrupção e recuperação "não estão estabelecidas".

**Opções avaliadas**
| Caminho | Viável? | Risco |
|---|---|---|
| M-UPGRADE novo no Wine/Docker | Não (KS ausente, não detecta) | nenhum, mas não funciona |
| M-UPGRADE Qt antigo (jul/2026) no Wine | Detecta (WinMM) | a troca para a identidade `4d4a:4155` no meio da gravação provavelmente não aparece para o Wine (lista MIDI fixa); pedal ficaria no carregador |
| Gravador nativo Linux (protocolo do FM-1) | Possível | ninguém fez no Tank G; interrupção sem recuperação estabelecida |
| **VM Windows (QEMU/KVM) com USB repassado por fabricante `4c4a` e `4d4a`** | Sim | baixo: é o fluxo oficial em Windows real; o repasse por fabricante acompanha a troca de identidade |
| PC Windows ou Mac real | Sim | o mais baixo (fluxo suportado pelo fabricante) |
