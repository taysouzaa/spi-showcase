/**
 * main.tsx
 *
 * Ponto de entrada do frontend SPI.
 *
 * O que este arquivo faz:
 *  - Importa os estilos globais (Tailwind + variáveis CSS customizadas).
 *  - Monta o componente raiz `App` no elemento `#root` do HTML.
 *  - Usa `createRoot` (React 18) para habilitar renderização concorrente.
 *
 * Por que não usar `ReactDOM.render`?
 *  - `createRoot` é a API moderna do React 18 e habilita o modo concorrente,
 *    que melhora performance em listas longas e animações complexas.
 *  - `ReactDOM.render` (legado) foi depreciado no React 18.
 */
import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import './shared/styles/index.css';

// O `!` (non-null assertion) é seguro aqui: `#root` sempre existe em `index.html`.
createRoot(document.getElementById('root')!).render(<App />);
