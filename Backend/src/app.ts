/**
 * app.ts
 *
 * Composição da aplicação HTTP do backend SPI.
 *
 * O que este arquivo faz:
 *  - Cria e exporta a instância do Express (`app`).
 *  - Configura política de CORS a partir da variável CORS_ORIGINS.
 *  - Habilita parsing de JSON no corpo das requisições.
 *  - Cria o diretório de uploads em disco (se não existir) e o serve como estático.
 *  - Monta as rotas da API em `/` e em `/api` (compatibilidade com diferentes prefixos de deploy).
 *  - Registra o middleware centralizado de erros como último handler.
 *
 * Por que o app fica separado do server.ts?
 *  - Separar instância do Express de `listen` permite testes de integração sem abrir porta.
 *  - O server.ts carrega variáveis de ambiente e inicializa seeds antes de subir o servidor.
 */
import express, { type Request } from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { mkdirSync } from 'node:fs';
import routes from './routes/index.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { uploadsDir } from './config/paths.js';

export const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────

/**
 * Origens sempre permitidas por padrão.
 * Inclui domínio oficial do frontend e localhost para desenvolvimento.
 */
const DEFAULT_CORS_ORIGINS = [
  'https://seu-dominio.com.br',
  'https://www.seu-dominio.com.br',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

/**
 * Normaliza origem removendo espaços e barras finais.
 *
 * @param origin Origem bruta.
 * @returns Origem normalizada.
 */
function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, '');
}

/**
 * Resolve a política de origem CORS a partir de `CORS_ORIGINS`.
 *
 * Regras:
 *  - Variável ausente ou `*` → aceita qualquer origem (desenvolvimento/testes).
 *  - Lista separada por vírgula → aceita somente as origens informadas (produção).
 *
 * @returns `true` (reflete origem do request) ou lista de origens permitidas.
 */
function getCorsOrigin(): CorsOptions['origin'] {
  const raw = process.env.CORS_ORIGINS?.trim();
  const defaults = DEFAULT_CORS_ORIGINS.map(normalizeOrigin);

  // Sem CORS_ORIGINS configurado → usa apenas as origens padrão (nunca abre para todos).
  if (!raw) return defaults;
  // Valor explícito '*' → aceita qualquer origem (somente para ambientes de teste).
  if (raw === '*') return true;

  const envOrigins = raw
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  const allowedOrigins = Array.from(
    new Set([...defaults, ...envOrigins])
  );

  return allowedOrigins.length ? allowedOrigins : defaults;
}

const corsOrigin = getCorsOrigin();

// ─── Middlewares globais ───────────────────────────────────────────────────────

// Garante que `req.protocol` respeite `X-Forwarded-Proto` em ambientes com proxy reverso.
app.set('trust proxy', 1);

// ─── CORS — deve ser o PRIMEIRO middleware ─────────────────────────────────────
// CORS precisa rodar antes de qualquer outro middleware (helmet, rate limiters, etc.)
// para que TODAS as respostas — incluindo 429 e 5xx — carreguem os headers CORS.
// Sem isso, o browser bloqueia as respostas de erro no preflight OPTIONS.
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Responde ao preflight OPTIONS imediatamente após CORS definir os headers.
app.options('*', cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Segurança — Headers HTTP ──────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── Rate Limiting ─────────────────────────────────────────────────────────────

const AUTH_WINDOW_MS = 15 * 60 * 1000;

function buildClientIpKey(req: Request) {
  return ipKeyGenerator(req.ip || req.socket.remoteAddress || 'unknown');
}

function normalizeRateLimitField(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

// Combina IP com e-mail quando disponível para evitar que vários usuários
// atrás do mesmo proxy/NAT consumam a mesma cota de login.
function buildLoginAttemptKey(req: Request) {
  const ipKey = buildClientIpKey(req);
  const email = normalizeRateLimitField(req.body?.email);
  return email ? `${ipKey}:${email}` : ipKey;
}

/**
 * Limiter para tentativas de login.
 * Conta apenas falhas e segmenta por IP + e-mail para não bloquear usuários
 * legítimos em redes compartilhadas.
 */
const loginLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: buildLoginAttemptKey,
  message: { error: 'Muitas tentativas de login.' },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Limiter para refresh de sessão.
 * Mantém proteção contra abuse sem compartilhar a mesma cota do login manual.
 */
const refreshLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildClientIpKey,
  message: { error: 'Muitas renovações de sessão. Aguarde alguns minutos.' },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Limiter geral para todas as rotas autenticadas.
 * 300 requisições por IP em 1 minuto — protege contra DDoS leve.
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em instantes.' },
  skip: () => process.env.NODE_ENV === 'test',
});

/**
 * Limiter específico para criação de conta.
 * 5 registros por IP por hora — o sistema é para um grupo fechado de usuários.
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de cadastro. Tente novamente em 1 hora.' },
  skip: () => process.env.NODE_ENV === 'test',
});

app.use(generalLimiter);

// Habilita leitura de JSON no body de requisições POST/PUT/PATCH.
app.use(express.json());

// Rate limit específico por tipo de rota de autenticação.
// Fica após o JSON parser para permitir chave por IP + e-mail no login.
app.use([
  '/auth/login',
  '/api/auth/login',
], loginLimiter);

app.use([
  '/auth/refresh',
  '/api/auth/refresh',
], refreshLimiter);

// Rate limit mais restritivo para criação de conta.
app.use([
  '/auth/register',
  '/api/auth/register',
], registerLimiter);

// ─── Arquivos estáticos ────────────────────────────────────────────────────────

// Cria o diretório de uploads antes de servir; `recursive: true` não falha se já existir.
mkdirSync(uploadsDir, { recursive: true });

// Expõe arquivos salvos pelo multer para download direto pelo frontend.
// Em produção o ideal é usar CDN/bucket, mas o static do Express cobre ambientes simples.
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
  },
}));

// ─── Rotas ────────────────────────────────────────────────────────────────────

// Monta as rotas nos dois prefixos para suportar deploys com e sem `/api` no gateway.
// Exemplo: Railway serve em `/` enquanto alguns reversos proxy reescrevem para `/api`.
app.use(routes);
app.use('/api', routes);

// ─── Tratamento centralizado de erros ─────────────────────────────────────────

// Deve ser o ÚLTIMO middleware registrado; captura erros lançados por qualquer rota ou handler.
app.use(errorMiddleware);
