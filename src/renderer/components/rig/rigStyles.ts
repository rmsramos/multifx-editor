// Classes compartilhadas pelos blocos da pedaleira.

/** Bloco que não soa (desligado, zona morta, gate 0, IR off): tinta apagada, sem sumir. */
export const blockSurface = (active: boolean): string =>
  `transition-[filter,box-shadow,outline-color] duration-150 ease-out-strong shadow-[0_8px_16px_rgba(0,0,0,.45),inset_0_-5px_0_rgba(0,0,0,.22)] ${
    active ? '' : 'saturate-[.2] brightness-[.5]'
  }`

/** Contorno âmbar do bloco em edição (também é o foco visível por teclado). */
export const selectedRing = (selected: boolean): string =>
  `outline-offset-[3px] ${selected ? 'outline-[3px] outline-solid outline-tank-warn' : 'outline-none hover:outline-2 hover:outline-solid hover:outline-white/15'}`
