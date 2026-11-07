# Captura do M-EFCS 3.10.2311 (Flutter) — protocolo via sequenciador ALSA ✅

> Documento de engenharia reversa para interoperabilidade. Protocolo observado no tráfego MIDI entre o app oficial e o pedal; nenhum conteúdo do app ou do firmware é reproduzido aqui.

**Data:** 2026-11-02. **Método:** M-EFCS 3.10.2311 em Wine 11 (Docker, script local de container, não versionado),
pedal Tank G **v96**. O Wine fala MIDI pelo **sequenciador ALSA** (cliente `WINE midi driver`, porta
`128:1` → pedal `20:0`; pedal `20:0` → `128:0`), então a captura dispensa root/usbmon:

```
aseqdump -p 128:1,20:0     # 128:1 = TX (app→pedal), 20:0 = RX (pedal→app); ver `aconnect -l`
```

Os arquivos brutos do `aseqdump` são capturas locais, não versionadas.
Decodificação: `unpackJieli` + `liveBytesToPreset` do próprio app (script ad hoc com `vite-node`).

## Conexão

O log do app oficial confirma o layout de armazenamento: 36 presets de 21 bytes com offset 2, e identifica o pedal como Tank G.
O app não força atualização de firmware (mesmo havendo v98 publicada).

## Repouso: poll de status 1×/s (igual ao conhecido, menos agressivo que o app Qt)

```
TX: F0 00 32 0D 41 00 00 00 02 00 00 00 00 42 00 00 00 57 01 F7
RX: F0 00 32 0D 61 00 00 00 02 00 00 00 00 42 00 00 00 [00 00 00 08] 60 1A F7   ← banco 0, slot A, modo NORMAL
```
Status observados: `00 00 04 08` (1B), `00 00 7C 0F` (bypass) — batem com `parsePedalStatus`.

## ⭐ Escrita de parâmetros: comando `09 31` em BLOCO (novo para nós)

Cada mexida de knob envia **um único frame** com os 14 bytes de parâmetros (offsets live 4–17) empacotados
Jieli 8→7 (16 bytes), em vez de um `09 49` (tipo `11`) por parâmetro:

```
TX: F0 00 32 09 31 01 00 00 02 [04 00 00 00] [61 01 00 00] [16 bytes packed] [ck8&7F, ck8>>7] F7
RX: F0 00 32 01 08 00 00 00 00 7F 01 F7                                        ← ACK normal
```
Mesma forma do save `09 69 01 00 00 02 [addr] [50 02 00 00] [packed] [ck]`: `04 00 00 00` = offset inicial 4,
`61 01 00 00` = região/tipo de destino (ainda sem nome; 51 02 é a região lida do preset ativo).

Exemplos reais (1A; `unpackJieli` → 14 bytes = gate, ampType, gain, treble, middle, bass, volume, modFx, modSpeed, dlyMix, dlyTime, revDecay, revMix, irCab):
```
packed: 00 00 2C 78 73 67 0F 32 00 00 00 78 47 41 00 00  → raw 0 0 11 63 63 63 100 0 0 0 127 12  2 0   (Gain 99→11)
packed: 00 00 0C 7B 73 67 0F 32 00 00 00 78 47 41 0B 00  → raw 0 0 99 63 63 63 100 0 0 0 127 12 46 0   (Rev mix 2→46)
packed: 00 00 0C 7B 73 67 0F 32 00 00 00 78 47 45 0B 00  → raw 0 0 99 63 63 63 100 0 0 0 127 44 46 0   (Rev decay 12→44)
```
A leitura `0D 41` da região `51 02` logo depois devolveu exatamente esses valores (decay 44, mix 46) → o pedal
**aplicou o bloco**. Ordem dos bytes = a nossa (`preset-codec`), reconfirmada.

**Checksum — CONFIRMADO em 5/5 amostras (gain, rev mix, rev decay, gate, cab):** `ck8 = (217 − Σraw) mod 256`,
enviado como `[ck8 & 0x7F, ck8 >> 7]` — mesma família 8-bit do save (`230 − addrTerm − Σraw`). O app **sempre**
envia o bloco fixo 4–17 (addr 4, 14 bytes), inclusive para gate (offset 4) e CAB (offset 17); por isso o termo
do endereço não pôde ser isolado (hipótese por analogia com o save: `221 − addr − Σraw`). Para implementar basta
reproduzir exatamente o frame observado (addr 4, 14 bytes, base 217).

**Implicação para o MultiFX Editor:** `ParamWriteQueue` faz até 21 escritas sequenciais (~0,3 s cada) para
aplicar um preset; com `09 31` o bloco 4–17 vai num frame só. Falta ver como o app novo escreve enables (0–3)
e cor (18–20) — se também por `09 31`, "aplicar preset" vira 1–3 frames.

## Troca de preset e bypass: `09 49` tipo `1E`, dado `01`

```
F0 00 32 09 49 00 00 00 02 [01 00 00 00] 1E 00 00 00 01 [30 00] F7   → status passou a 1B   (índice 1)
F0 00 32 09 49 00 00 00 02 [00 00 00 00] 1E 00 00 00 01 [32 00] F7   → status 1A            (índice 0)
F0 00 32 09 49 00 00 00 02 [00 00 00 08] 1E 00 00 00 01 [30 00] F7   → status 7C 0F (bypass ON)
F0 00 32 09 49 00 00 00 02 [00 00 00 00] 1E 00 00 00 01 [32 00] F7   → status 1A (bypass OFF)
```
Estrutura: `[índice do preset, 00, 00, flag bypass 08/00]`, tipo `1E`, dado `01` (o app Qt mandava `7F`/`41`).
Isso **reinterpreta** o "registro 0x20" do bypass da captura antiga: `0x20` era o índice do preset corrente (9A).
`buildBypass(on, index)` já envia o índice, então o nosso bypass está correto. Trocar preset por `1E` é uma
alternativa ao Program Change que usamos (mesmo efeito observado no status).

## Segunda captura (enables, LED, gate, cab) — resultados

- **Enables (0–3): `09 49` tipo `11`, 1 byte, igual ao nosso** (checksum `670 − 2Σ` confere):
  ```
  F0 00 32 09 49 00 00 00 02 01 00 00 00 11 00 00 00 01 50 03 F7   → MOD on
  F0 00 32 09 49 00 00 00 02 01 00 00 00 11 00 00 00 00 52 03 F7   → MOD off
  ```
- **Cor do LED: `09 59` tipo `31`, 3 bytes (R G B 7-bit) num frame só:**
  ```
  F0 00 32 09 59 00 00 00 02 12 00 00 00 31 00 00 00 7F 5F 00 40 0A F7   (addr 0x12 = 18)
  ```
  Checksum `40 0A` (= 1344) **não** segue `670 − 2Σ` nem a família 8-bit — continua indecifrado (como no app Qt).
  Leitura 51 02 depois: bytes 18–20 = `255 47 0` (R virou 0xFF, G = 0x5F>>1) — a relação escrita↔armazenado
  não é um simples `<<1`; fica em aberto. O nosso caminho (3 × `09 49` em 18/19/20) segue válido.
- **Gate (offset 4) e CAB (17): vão no mesmo bloco `09 31` 4–17** — o bloco é sempre completo.
- **Save (`09 69` + `09 41`): não capturado** — o usuário não clicou em *Save* nesta rodada. O botão **Sync** do
  M-EFCS (ao lado da cor) coincide, na linha do tempo, com uma leitura `0D 41` da região `51 02` (preset ativo)
  → hipótese: *Sync* relê o pedal para a UI, não grava.
- Leitura final 51 02 decodificada pelo nosso codec: gate 50, amp 1J120_CL, gain 99, treble/middle/bass 63,
  volume 100, delay time 127, reverb decay 44 / mix 46, irCab 2 — tudo coerente com a UI do app.

## Resposta completa do discovery (2026-11-02, pedal v96)

```
F0 00 32 45 58 01 00 00 2A 41 1C 2D 6A 72 48 1D 19 5F 60 64 31 03 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 60 2D F7
```
O M-EFCS 3.10 extrai daqui o nome `TANK-Gv2` e a versão 96. Próximo passo: decodificar (provável packing Jieli
nos bytes 8–21; `0x60` = 96 aparece no fim) para exibir firmware na barra de status do MultiFX Editor.
