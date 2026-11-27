// Classes compartilhadas pelos blocos da pedaleira.

/** Bloco que não soa (desligado, zona morta, gate 0, IR off): tinta apagada, sem sumir. */
export const blockSurface = (active: boolean): string =>
  `transition-[filter,box-shadow,outline-color] duration-150 ease-out-strong shadow-[0_8px_16px_rgba(0,0,0,.45),inset_0_-5px_0_rgba(0,0,0,.22)] ${
    active ? '' : 'saturate-[.2] brightness-[.5]'
  }`

/**
 * Contorno âmbar do bloco em edição. Vai no CONTÊINER do bloco, fora do filtro de "apagado":
 * se ficasse no botão, um bloco desligado e selecionado teria o contorno escurecido junto.
 */
export const selectedRing = (selected: boolean): string =>
  selected ? 'outline-[3px] outline-solid outline-tank-warn outline-offset-[3px]' : ''

/** Foco do teclado e hover no corpo do bloco (no selecionado, o anel de foco fica mais afastado). */
export const focusRing = (selected: boolean): string =>
  `outline-0 outline-offset-[3px] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-tank-focus ${
    selected ? 'focus-visible:outline-offset-[7px]' : 'hover:outline-2 hover:outline-solid hover:outline-white/15'
  }`
