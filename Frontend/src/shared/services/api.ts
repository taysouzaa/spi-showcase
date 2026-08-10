/**
 * shared/services/api.ts
 *
 * Utilitários de URL e conectividade do frontend SPI.
 *
 * O que este arquivo faz:
 *  - Resolve a URL base da API em três camadas de prioridade:
 *      1. `window.__SPI_CONFIG__.API_URL` → configuração injetada em runtime (ex.: nginx/CDN).
 *      2. `import.meta.env.VITE_API_URL`  → variável definida no build (`.env` local ou CI).
 *      3. `http://<hostname>:3333`         → fallback para desenvolvimento local.
 *  - Exporta `buildApiUrl(path)` para montar URLs absolutas de forma consistente.
 *  - Exporta `pingBackend(timeoutMs)` para verificar disponibilidade do servidor antes do login.
 *
 * Por que três camadas?
 *  - `window.__SPI_CONFIG__` permite reconfigurar a URL da API sem recompilar o frontend
 *    (útil em deploys onde frontend e backend ficam em domínios separados).
 *  - `VITE_API_URL` cobre ambientes de desenvolvimento e CI onde o backend roda em URL conhecida.
 *  - O fallback dinâmico (`window.location.hostname:3333`) funciona mesmo sem qualquer configuração.
 */

// ─── Resolução da URL base ─────────────────────────────────────────────────────

// Determina o host e protocolo atuais do navegador para o fallback dinâmico.
const DEFAULT_HOST =
  typeof window !== 'undefined' && window.location.hostname
    ? window.location.hostname
    : 'localhost';
const DEFAULT_PROTOCOL =
  typeof window !== 'undefined' && window.location.protocol
    ? window.location.protocol
    : 'http:';

// Fallback final: assume que o backend roda na mesma máquina na porta 3333.
const DEFAULT_BASE = `${DEFAULT_PROTOCOL}//${DEFAULT_HOST}:3333`;

// Configuração injetada em runtime (por nginx, servidor estático, ou script inline no HTML).
const CONFIG_API_BASE =
  typeof window !== 'undefined'
    ? (window as any).__SPI_CONFIG__?.API_URL
    : undefined;

// Cadeia de resolução com fallback: runtime → build → dinâmico.
const RAW_API_BASE =
  (typeof CONFIG_API_BASE === 'string' && CONFIG_API_BASE.trim().length > 0
    ? CONFIG_API_BASE
    : (import.meta as any).env?.VITE_API_URL) || DEFAULT_BASE;

// Remove barra final para evitar dupla barra ao concatenar com o path.
const API_BASE = RAW_API_BASE.replace(/\/+$/, '');

// ─── Funções públicas ──────────────────────────────────────────────────────────

/**
 * Constrói URL absoluta para um caminho da API.
 * Garante que há sempre exatamente uma barra separando base e path.
 *
 * @param path Caminho relativo da rota (com ou sem `/` inicial, ex.: `/history` ou `history`).
 * @returns URL completa para uso em `fetch`.
 */
export function buildApiUrl(path: string) {
  if (!path) return API_BASE;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Verifica se o backend está respondendo antes de tentar autenticar.
 * Tenta `/health` e `/api/health` para cobrir deploys com e sem prefixo `/api`.
 *
 * Por que verificar antes do login?
 *  - Permite diferenciar "credenciais inválidas" de "servidor offline" e exibir
 *    mensagem de erro adequada ao usuário.
 *
 * @param timeoutMs Tempo máximo de espera por tentativa (padrão: 8 segundos).
 * @returns `true` quando pelo menos uma das URLs responde com sucesso.
 */
/**
 * Tenta renovar a sessão via cookie httpOnly.
 * O browser envia o refreshToken cookie automaticamente com `credentials: 'include'`.
 * Atualiza o user em localStorage em caso de sucesso.
 * Retorna true se o refresh funcionou.
 */
export async function refreshAuthToken(): Promise<boolean> {
  try {
    const resp = await fetch(buildApiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({}),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
    return true;
  } catch {
    return false;
  }
}

/**
 * fetch autenticado via cookie httpOnly (credentials: 'include').
 * Em caso de 401, tenta um refresh silencioso e refaz a requisição uma vez.
 * Se o refresh falhar, retorna a resposta 401 para o caller tratar (ex: logout).
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  let resp = await fetch(url, { ...options, credentials: 'include' });

  if (resp.status === 401) {
    const refreshed = await refreshAuthToken();
    if (refreshed) {
      resp = await fetch(url, { ...options, credentials: 'include' });
    }
  }

  return resp;
}

export async function pingBackend(timeoutMs = 15000) {
  const base =
    (typeof CONFIG_API_BASE === 'string' && CONFIG_API_BASE.trim().length > 0
      ? CONFIG_API_BASE
      : (import.meta as any).env?.VITE_API_URL) || DEFAULT_BASE;
  const trimmedBase = base.replace(/\/+$/, '');
  const urls = [buildApiUrl('/health')];

  // Adiciona variante com `/api` apenas se a base ainda não termina com `/api`.
  if (!trimmedBase.endsWith('/api')) {
    urls.push(`${trimmedBase}/api/health`);
  }

  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (resp.ok) return true;
    } catch {
      // Continua para a próxima URL em caso de erro de rede ou abort.
    } finally {
      clearTimeout(timer);
    }
  }

  return false;
}
