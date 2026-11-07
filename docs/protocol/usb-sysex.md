# Captura do M-EFCS via USB — protocolo de presets REAL ✅

> Documento de engenharia reversa para interoperabilidade. Protocolo observado no tráfego MIDI entre o app oficial e o pedal; nenhum conteúdo do app ou do firmware é reproduzido aqui.

**Data:** 2026-06-10. **Método:** app oficial M-EFCS (versão Windows, Qt6) rodando em Wine 11 dentro
de container Docker descartável; tráfego USB capturado no host via `usbmon` (bus 1,
device 9 = Tank G `4c4a:c755`, interface MIDI 4, EP bulk `0x04`/`0x84`).
Decodificador: `scripts/decode-usbmon-sysex.mjs`.

## Refuta 3 conclusões antigas da documentação

1. ❌→✅ **"Write 09 49 não funciona via USB"** — FUNCIONA. O app usa `09 49` o tempo
   todo para escrever parâmetros. A falha antiga era checksum errado, não o comando.
2. ❌→✅ **"Device é silencioso, nunca responde"** — RESPONDE no EP bulk IN `0x84`:
   ACK `01 08` para writes, `0d 61`/`0d 69`/`0d 71` para reads, `45 58` para discovery.
3. ❌→✅ **"Upload é provavelmente BLE-only"** — o desktop faz tudo via USB-MIDI SysEx.

## Framing

Tudo é SysEx M-VAVE (`F0 00 32 ... F7`) embrulhado em USB-MIDI (pacotes de 4 bytes,
CIN 0x4/0x6/0x7 para SysEx). O decodificador remonta o SysEx limpo.

## Vocabulário observado (SysEx decodificado)

### Discovery
```
TX: f0 00 32 45 00 00 00 40 7f f7
RX: f0 00 32 45 58 01 00 00 2a 41 1c 2d 6a 72 48 1d 19 5f 60 64 31 03 ... f7
```

### Read memory (0D 41) → resposta 0D 61 / 0D 69 / 0D 71
Polling constante enquanto idle (milhares de vezes). Estrutura:
```
TX: f0 00 32 0d 41 00 00 00 02 [addr LE32] [len/flags...] [ck1 ck2] f7
RX: f0 00 32 0d 61 00 00 00 02 [addr LE32] ... [dados] [ck1 ck2] f7
```
Endereços vistos no polling: `00 00 00 00`, `51 02 00 00`, `1d 00 00 00`,
`60 5e 00 00`. (Respostas 0d 69 e 0d 71 trazem blocos maiores de estado.)

### Write (09 49) → resposta ACK 01 08  ⭐
```
TX: f0 00 32 09 49 00 00 00 02 [addr LE32] [tipo/len: 11 00 00 00] [data] [ck1 ck2] f7
RX: f0 00 32 01 08 00 00 00 00 7f 01 f7   (ACK de sucesso)
```
Exemplos reais (1 byte de dado, escrita parâmetro a parâmetro):
```
f0 00 32 09 49 00 00 00 02 04 00 00 00 11 00 00 00 14 24 03 f7
f0 00 32 09 49 00 00 00 02 06 00 00 00 11 00 00 00 27 7a 02 f7
f0 00 32 09 49 00 00 00 02 08 00 00 00 11 00 00 00 4c 2c 02 f7
```
Variante tipo `1e` — ✅ DECIFRADA em hardware (2026-06-12): **select preset via SysEx**.
O campo de endereço carrega o ÍNDICE do preset (0-35); o pedal troca de preset e
responde ACK `01 08` (ao contrário do Program Change, que é cego):
```
f0 00 32 09 49 00 00 00 02 23 00 00 00 1e 00 00 00 7f 71 03 f7   → pedal foi p/ 9D (0x23=35)
f0 00 32 09 49 00 00 00 02 00 00 00 00 1e 00 00 00 41 33 01 f7   → pedal foi p/ 1A (0x00=0)
```
- Byte de dado (`7f` vs `41`): significado desconhecido — ambos funcionaram.
- ⚠️ Isso põe em dúvida a leitura "enables/flags via região `1e` (addr `00`/`01`)" do
  fluxo de save abaixo — aqueles writes podem ter sido selects de preset (1A/1B).
  Reexaminar na próxima captura.

## Checksum (2 bytes, `ck1 ck2`, ambos 7-bit) — ✅ DECIFRADO (família 0x11)

`ck = ck1 + 128*ck2` (14-bit, little-endian 7-bit). Para a família de escrita de
parâmetro (tipo `0x11`):
```
ck = (670 - 2*Σ(body)) mod 16384      body = bytes de "09 49" até antes do checksum
ck1 = ck & 0x7F ;  ck2 = (ck >> 7) & 0x7F
```
**Validado em 61/61 amostras reais.** Implementado e testado em
`src/main/protocol/mvave-codec.ts` (`mvaveWriteChecksum`, `buildParamWrite`) com
fixtures da captura em `tests/main/protocol/mvave-codec.test.ts`.

- Família tipo `0x1e` usa BASE 537 (mesma forma `537 - 2*Σbody` p/ writes de 1 byte) —
  região diferente (enables/flags). Generalizar a BASE por tipo: TODO.

## Fluxo de "salvar preset" (sequência cronológica capturada) ✅

1. **Aplicar ao vivo** (cada knob/troca): `09 49 <addr> 11 …` por parâmetro → ACK.
2. **Gravar o preset**: rajada de `09 49` tipo `0x11` cobrindo addr `04..11`
   = bytes 4..17 do preset (irCab, ampType, gain, bass, mid, treble, vol, delayTime,
   delayMix, modSpeed, modDepth, modType). **Confirma o layout deduzido dos binários.**
   - addr `0d`/`0e` (reverb mix/decay) não apareceram nesta sessão (preset sem reverb?).
   - enables/flags via região `1e` (addr `00`/`01`).
3. **Commit em flash**: `09 41 00 00 00 02 00 00 00 00 0f 00 00 00 0b 00 f7`
   (provável save permanente; `0b` = índice do preset/slot).
4. Comandos auxiliares vistos: `09 69` (escrita de bloco em região `0x17`), leituras
   `0d 69`/`0d 49` de status entre etapas.

## Afinador (tuner) — ✅ COMANDÁVEL por CC (decifrado 2026-06-12)

**Conclusão: o afinador PODE ser acionado por software** — via MIDI CC, em malha
fechada. O app oficial NÃO faz isso (só observa), mas nós conseguimos. Scripts:
scripts locais de sondagem do afinador (não versionados).

### Estado do sistema é legível na região `0x42`
```
TX: f0 00 32 0d 41 00 00 00 02 00 00 00 00 42 00 00 00 57 01 f7
RX: f0 00 32 0d 61 00 00 00 02 00 00 00 00 42 00 00 00 [bb bb bb MM] ck f7
```
O ÚLTIMO byte do payload (`MM`) é o modo de sistema (confirmado com o usuário olhando
o pedal):

| `MM` | Modo |
|------|------|
| `0x08` | NORMAL (tocando preset) |
| `0x00` | LIVE |
| `0x10` | AFINADOR |

(os 3 primeiros bytes do payload são voláteis — provável contador/pitch; não usados.)

### Os modos formam uma LINHA, navegável por 2 CCs (clique = press 127 + release 0)
```
NORMAL (0x08) ←──CC26──→ LIVE (0x00) ←──CC27──→ AFINADOR (0x10)
```
- **CC26** clique: alterna NORMAL ↔ LIVE
- **CC27** clique: alterna LIVE ↔ AFINADOR  (LIVE é o estado central)
- O toggle dispara na **borda de soltar** (valor 0). É preciso ~200ms entre o press
  (127) e o release (0) — clique rápido demais (≤30ms) é ignorado pelo firmware.
- Validado: 6/6 alternâncias limpas por CC; 6/6 ciclos entra/sai do afinador.

### Controle robusto = malha fechada (NÃO confiar em 1 clique cego)
O efeito de cada clique depende do estado atual; a forma confiável é: **ler `0x42`,
dar um clique em direção ao alvo, reler, repetir** até chegar no modo desejado.
o script local de sondagem do afinador (não versionado) implementa exatamente isso (≤8 passos).
- Entrar no afinador a partir do normal = 2 cliques (NORMAL→LIVE→AFINADOR).
- Sair = caminho inverso.

⚠️ O gesto físico B+C NÃO emite MIDI (monitor capturou zero bytes ao pressionar) —
por isso não dá para "gravar" o comando; ele foi deduzido pela varredura de CC com o
detector `0x42`. Histórico: a varredura de write `09 49` na região `0x42` (512 valores de ck,
feita com um script local não versionado) NÃO funciona; a região é só-leitura; o caminho é CC.

### Indicador no app
Além de ligar/desligar, dá para exibir "afinador ativo" lendo `0x42` por polling.
A leitura de nota/pitch durante o afinador ainda não foi decifrada (os 3 bytes
voláteis do payload são candidatos — investigar se quisermos mostrar a agulha).

## Bypass — ✅ DECIFRADO (relativo ao preset, 2026-06-12)

O M-EFCS tem um **bypass** (o app oficial tem um interruptor de bypass e um knob de volume do bypass). Captura do app
acionando o switch (ON depois OFF), com ACK `01 08` em ambos:
```
ON : f0 00 32 09 49 00 00 00 02  20 00 00 08  1e 00 00 00  7f  75 03  f7
OFF: f0 00 32 09 49 00 00 00 02  20 00 00 00  1e 00 00 00  7f  77 03  f7
```
- Família `09 49` tipo `0x1e`. **É RELATIVO AO PRESET ATUAL**: o comando é "selecionar o
  preset `<índice>` com flag de bypass". addr = `[índice, 00, 00, flag]`, flag `08` (on) /
  `00` (off), dado `7f`. Na captura o M-EFCS estava no preset **9A** (índice 32 = `0x20`),
  por isso o addr começava com `20`. ⚠️ Usar `0x20` fixo faz o pedal PULAR para 9A em
  qualquer outro preset — confirmado no hardware (em 1A, o `20 00 00 08` jogou o pedal p/ 9A).
  O `off` (`<índice> 00 00 00`) é, na prática, um re-select do preset, que limpa o bypass.
- **Checksum DECIFRADO** (validado contra a captura no índice 32 E ACKs ao vivo no índice 0):
  `ck14 = (on ? 565 : 567) − 2·índice`, fatiado em dois bytes 7-bit (LE). Implementado em
  `buildBypass(on, index)` (`mvave-codec.ts`). Ex.: índice 0 → ON `…7f 35 04`, OFF `…7f 37 04`.
- Implementação no app: `transport.setBypass(on, index)`; o renderer passa o índice do
  preset atual; trocar de preset (Program Change) limpa o bypass → o app sincroniza com
  `setBypass(false)` no `selectPreset`.
- **Observável na região `0x42`**: o payload muda de `08 10 00 08` (normal) para
  `08 10 7c 0f` quando o bypass está ON. ⚠️ O último byte vira `0x0f` (não é um dos modos
  08/00/10), então `parseSystemMode` retorna `null` durante o bypass — inofensivo (o
  TunerMonitor ignora). Hipótese não confirmada: modo = `byte[3] & 0x18` (bypass setaria
  bits baixos); só temos 1 amostra de bypass — não baixado no codec.
- **Sem footswitch físico de bypass** no pedal (A/B/C/D = efeitos/presets; B+C = modos de
  sistema). Logo o bypass é comandado só por software → estado otimista no app é confiável.

## Layout do preset — CONFIRMADO no app oficial (Tank-Gv2, 2026-06-10)

Cruzando um export de preset do próprio pedal com os valores na
tela do M-EFCS. **O endereço de escrita 09 49 == este offset de byte.**

**Offsets de EXIBIÇÃO do M-EFCS** (confirmado contra 8 presets de fábrica, 72 pontos,
2026-06-11): exibe `byte+1` em ampType, gain, treble, middle, bass, modSpeed, dlyTime e
rvbMix; exibe o `byte` puro em noiseGate e volume; knobs-bloco exibem a quantidade do
bloco. Nosso app replica via `displayOffset` no Knob (byte interno permanece 0-127).

| Byte | Campo | Confiança |
|------|-------|-----------|
| 0 | enable AMP | ✅ corrigido 2026-06-11 (2A de fábrica `01 01 00 00` liga AMP+MOD no pedal) |
| 1 | enable MOD | ✅ |
| 2 | enable DELAY | ✅ |
| 3 | enable REVERB | ✅ corrigido 2026-06-11 |
| 4 | NOISE GATE (0-127, sempre ativo) | ✅ (52=52) |
| 5 | AMP TYPE (0-8) | ✅ |
| 6 | GAIN | ✅ |
| 7 | TREBLE | ✅ |
| 8 | MIDDLE | ✅ |
| 9 | BASS | ✅ |
| 10 | VOLUME | ✅ |
| 11 | MOD FX (bloco: tipo+qtd) | ✅ confirmado por knob |
| 12 | MOD SPEED | ✅ |
| 13 | DLY MIX (bloco) | ✅ |
| 14 | DLY TIME | ✅ |
| 15 | RVB DECAY (bloco) | ✅ |
| 16 | RVB MIX | ✅ |
| 17 | IR CAB (índice 0-8) | ✅ (7=7) |
| 18-20 | cor RGB | ✅ |

### Knobs codificados em blocos (⚠️ descoberta do usuário, 2026-06-10)
**MOD FX, DLY MIX e RVB DECAY** têm display **0-40 em blocos** ("3 opções", primeiro bloco
inicia em 1 e vai até 40). Hipótese forte: cada um é **um único byte que codifica o TIPO do
efeito (qual bloco) + a quantidade (posição 1-40 no bloco)**. Isso explica onde mora o "tipo"
de mod/delay/reverb (não há seletor de tipo separado no preset). Ex.: DLY MIX display 40 →
byte 127; MOD FX ao vivo escreveu em addr 0x0f. A ordem exata de 11-16 e a fórmula de
bloco→tipo precisam de uma confirmação dirigida por knob.

### Correções que isto trouxe ao codec
- byte 4 = NOISE GATE (valor), **não** irCab nem toggle.
- byte 17 = IR CAB índice 0-8 (**não** 72-87, **não** modType).
- **Não existe "MOD TYPE"** separado; tipo embutido nos bytes de bloco.
- Enables em 0-3 = AMP, MOD, DELAY, REVERB (ordem confirmada pelo estado distintivo; ver a seção seguinte).

### Enables: ordem ÚNICA (corrigido 2026-06-11)
**addr/byte 0 = AMP, 1 = MOD, 2 = DELAY, 3 = REVERB** — tanto na escrita ao vivo
(confirmado toggle a toggle no pedal) quanto no registro/arquivo (confirmado pelo 2A de
fábrica: `01 01 00 00` e o pedal liga AMP+MOD). Hipótese inicial, descartada: uma
"ordem de arquivo" divergente (0=REVERB…3=AMP) era um erro de interpretação do codec; não existem
duas ordens, e o remap 0↔3 do `presetToLiveBytes()` foi removido (hoje é identidade).

## Leitura de presets — DECIFRADA (⭐ 2026-06-11, validada 758/758 vs factory bin)

**Empacotamento Jieli (cascata LSB-first 7↔8):** todo payload de leitura usa
`p[i] = ((raw[i] << i) | (raw[i-1] >> (8-i))) & 0x7f` em grupos de 7 bytes crus → 8
MIDI-safe. Implementado em `src/main/protocol/jieli-pack.ts`.

**Mapa de regiões de leitura (0d 41, frames replay com ck fixo):**
| Região | Resposta | Conteúdo |
|---|---|---|
| `42` | `0d 61` 24B | status (polling do M-EFCS) |
| `1d` | `0d 49` 21B | desconhecido (payload 1 byte) |
| `51 02` | `0d 69` 44B | **preset ativo** (21 bytes, ORDEM AO VIVO: 0=AMP…3=REVERB) |
| `60 5e` | `0d 71` 886B | **ROM de fábrica (A5 5A + 36×21)**, não é o storage do usuário (este é a região `50 02`) |

Frame de leitura do blob: `F0 00 32 0D 41 00 00 00 02 00 00 00 00 60 5E 00 00 03 00 F7`.
Estrutura da resposta: 17 bytes de header + payload packed + 1 byte ck + F7
(corte calibrado contra o factory bin: 758/758 bytes idênticos).
A fórmula do checksum das LEITURAS segue não decifrada — replay dos frames capturados.

## Save na flash — DECIFRADO o mecanismo (⭐ 2026-06-11, captura pcap binária)

Captura binária via `tcpdump -i usbmon1 -w` (linktype 220, URBs completas — sem o
truncamento de ~32 bytes da interface texto). Decodificador: `scripts/decode-pcap-sysex.mjs`.
Captura pcap (local, não versionada) com 2 saves: gain em 1A; vol+amp em 2C.

**Sequência de save (por preset):**
1. `09 49 <addr> 11 …` — escreve cada parâmetro alterado no buffer AO VIVO (volátil).
2. `09 69` — escreve o **preset inteiro** (Jieli-packed) na região `50 02` (storage do slot).
3. `09 41` — **commit na flash**.

**Layout do frame `09 69`:**
```
f0 00 32 | 09 69 | 01 00 00 02 | [slot 4B LE] | 50 02 00 00 | [packed: Jieli(21B preset)] | [ck1 ck2] | f7
```
- Corte do payload packed: `slice(17, len-3)` → `unpackJieli` → 21 bytes do preset (mesma ordem
  única: 0=AMP…3=REVERB). Os bytes packed começam em `01 00 00 08…` (= packing de `01 00 00 01…`).
- Validado: 1A decodificou gain=0x15(21), 2C decodificou ampType=01 + volume=0x5a(90) —
  batem exatamente com os valores que o usuário alterou.
- **Campo de slot** (idx 9-12, LE32): 1A→`02 00 00 00` (=2); 2C→`00 01 00 00` (=65536).
  Mapeamento índice→campo ainda NÃO decifrado (só 2 amostras; 2.5 não-inteiro entre elas).

**Commit `09 41` é GENÉRICO** (refuta doc antiga): `f0 00 32 09 41 00 00 00 02 00 00 00 00 0f 00 00 00 0b 00 f7`
é **idêntico** nos dois saves (1A e 2C). Logo `0b` NÃO é índice de slot — o commit só
"sela" o que o `09 69` colocou em `50 02`. ck `0b 00` é constante.

**Região `60 5e` é ROM de fábrica / cache**, NÃO o storage real dos presets do usuário.
Lê sempre os valores de fábrica mesmo após saves do M-EFCS — por isso não serve como
oráculo de verificação. Verificação real = `09 69`+`09 41`, depois PC sai/volta (recarrega
da flash) e lê o preset ativo via região `51 02`.

**Checksum do `09 69` — RESOLVIDO (2026-06-11, corrigido 2026-06-12).** É de 8 bits
(não 14 como a família `09 49`):

```
ck8 = (230 − (addr & 0xFF) − (addr >> 8) − Σ(21 bytes crus)) mod 256
ck1 = ck8 & 0x7F ; ck2 = ck8 >> 7
```

O termo do addr é a **soma dos bytes de 8 bits**, NÃO o valor numérico — as duas formas
coincidem com addr < 256, e as 12 amostras de captura (captura local, não versionada, addr 2 e
128) nunca discriminaram. A forma numérica falhava silenciosamente (sem ACK) em slots ≥ 13
(addr ≥ 275). Decifrado via sweep de ck na leitura `0d 41` da região `50 02` (addr 275
respondeu com ck 210 = numérico−1) e confirmado por ACK do hardware em writes no-op nos
slots 13/32/35 (goldens: ck 41/150/68).

**Leitura da região `50 02` (storage real)** usa a mesma fórmula com Σ=0:
`0d 41 00 00 00 02 [addr 7bit-LE] 00 00 50 02 00 00 [ck1 ck2] f7` → resposta `0d 69` com
24B packed (21 raw a partir do addr). Blob inicia com A5 5A em addr 0. Os cks replay das
leituras `60 5e` (`03 00`), `51 02` (`56 01`) e `1d` (`2a 00`) seguem OUTRA fórmula, ainda
não decifrada.

## Pendências

- Decifrar a fórmula de ck das leituras `0d 41` fora da região `50 02` (hoje são replay).
- Mapear a região `1e` (enables, cor RGB?).
- Confirmar endereços de reverb (`0d`/`0e`) capturando um preset COM reverb ativo.
