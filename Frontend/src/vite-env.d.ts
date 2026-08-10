/**
 * vite-env.d.ts
 *
 * Declarações de tipos globais do Vite para o frontend SPI.
 *
 * O que este arquivo faz:
 *  - Referencia os tipos client do Vite (`import.meta.env`, `import.meta.hot`, etc.).
 *  - Declara o módulo `*.png` para que imports de assets de imagem sejam tipados
 *    como `string` (URL do asset no bundle gerado pelo Vite).
 *
 * Por que declarar `*.png`?
 *  - O TypeScript por padrão não sabe como tratar `import logo from './logo.png'`.
 *    Sem esta declaração, o compilador emite erro de "módulo não encontrado".
 *  - O Vite processa os imports de assets e os substitui pela URL correta no bundle,
 *    então o tipo `string` é o retorno correto.
 */
/// <reference types="vite/client" />

declare module '*.png' {
  const src: string;
  export default src;
}
