# MultiFX Editor

Editor desktop para Linux do pedal multi-efeitos M-VAVE Tank G. Não oficial.

[Read in English](README.md)

> [!NOTE]
> Projeto independente, não é afiliado nem endossado pela M-VAVE. "M-VAVE" e "Tank G" são marcas dos seus titulares, citadas apenas para indicar compatibilidade. Os nomes de amplificadores e gabinetes identificam os equipamentos que inspiram os modelos do pedal e pertencem aos seus titulares.

> [!WARNING]
> Este app grava na memória do pedal por um protocolo não documentado pelo fabricante. Uso por sua conta e risco. Faça backup dos presets com o app oficial antes de usar. Não há garantia, e o uso pode anular a garantia do fabricante.

## Recursos

- 36 presets em 9 bancos (slots A/B/C/D), lidos do pedal e gravados nele
- Edição dos módulos AMP, MOD, Delay, Reverb, IR Cab e Noise Gate
- Seletor de cor do LED
- Importação e exportação de presets em JSON
- Afinador e bypass controlados pelo app
- Sincronização nos dois sentidos com o pedal
- Interface em inglês e português do Brasil

Também há uma ferramenta de linha de comando para diagnóstico: `scripts/multifx-cli.mjs`.

## Requisitos

- Linux
- `alsa-utils` (fornece o `amidi`)
- Seu usuário no grupo `audio`, ou rode `sudo bash scripts/setup-udev.sh` para instalar as regras udev
- O pedal conectado por USB

## Instalação

Baixe o AppImage na [página de releases](https://github.com/rmsramos/multifx-editor/releases) e execute:

```bash
chmod +x MultiFX-Editor-*.AppImage
./MultiFX-Editor-*.AppImage
```

## Compilar a partir do código

```bash
npm install
npm run dev          # desenvolvimento (Electron + Vite)
npm run build:linux  # AppImage em release/
npm test             # suíte de testes
```

## Documentação do protocolo

- [Protocolo USB SysEx](docs/protocol/usb-sysex.md)
- [USB SysEx: escrita em bloco usada pelo M-EFCS 3.10](docs/protocol/usb-sysex-mefcs-310.md)
- [Atualização de firmware (OTA)](docs/protocol/ota-firmware.md)

O protocolo foi obtido por observação do tráfego MIDI entre o app oficial e o pedal, para fins de interoperabilidade. Entendemos que esse tipo de análise é permitido pela Lei 9.609/98 art. 6º IV, pela Diretiva 2009/24/CE art. 6º e pelo DMCA §1201(f) dos EUA. Nenhum conteúdo do app oficial, do firmware ou do manual é reproduzido neste repositório. Isto não é aconselhamento jurídico.

## Contribuindo

Issues e pull requests são bem-vindos. As mudanças devem vir com testes, e `npm test` deve passar.

## Licença

[GPL-3.0-only](LICENSE)
