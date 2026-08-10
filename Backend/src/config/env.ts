/**
 * config/env.ts
 *
 * Normalização de variáveis de ambiente do backend SPI.
 *
 * O que este arquivo faz:
 *  - Define um mapa de aliases (nomes em português/legado → nome canônico).
 *  - Para cada alias, se a variável canônica não estiver definida, copia o valor do alias.
 *  - Garante retrocompatibilidade com nomes antigos sem alterar o código que os consome.
 *
 * Por que aliases em português?
 *  - Facilita configuração para usuários não técnicos em painéis de deploy (Railway, Render).
 *  - Mantém compatibilidade com nomes definidos antes da padronização do projeto.
 *  - A normalização é feita em memória; nenhum arquivo é alterado em disco.
 *
 * Como usar:
 *  - Chame `normalizeEnv()` o mais cedo possível (antes de ler qualquer config).
 *  - Após a chamada, use apenas os nomes canônicos (ex.: DATABASE_URL, ADMIN_EMAIL).
 */
type EnvMap = Record<string, string[]>;

// ─── Mapa de aliases ───────────────────────────────────────────────────────────
// Chave = nome canônico. Valor = lista de aliases aceitos (verificados em ordem).
const ENV_ALIASES: EnvMap = {
  DATABASE_URL: ['URL_DO_BANCO_DE_DADOS', 'DATABASEURL'],
  DIRECT_URL: ['URL_DIRETA'],
  ADMIN_EMAIL: ['EMAIL_DO_ADMINISTRADOR', 'E-MAIL_DO_ADMINISTRADOR'],
  ADMIN_PHONE: ['TELEFONE_DO_ADMINISTRADOR', 'FONE_DO_ADMINISTRADOR'],
  ADMIN_NAME: ['NOME_DO_ADMINISTRADOR'],
  SEED_USERS_JSON: ['USUARIOS_SEED_JSON', 'USUARIOS_INICIAIS_JSON'],
  GOOGLE_DRIVE_DEFAULT_FOLDER_ID: [
    'ID_DA_PASTA_PADRAO_DO_GOOGLE_DRIVE',
    'ID_PASTA_PADRAO_GOOGLE_DRIVE',
  ],
  GOOGLE_SERVICE_ACCOUNT_FILE: [
    'ARQUIVO_DE_CONTA_DE_SERVICO_DO_GOOGLE',
    'ARQUIVO_CONTA_SERVICO_GOOGLE',
  ],
  GOOGLE_SERVICE_ACCOUNT_JSON: [
    'JSON_DE_CONTA_DE_SERVICO_DO_GOOGLE',
  ],
  GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: [
    'JSON_DE_CONTA_DE_SERVICO_DO_GOOGLE_BASE64',
  ],
  JWT_SECRET: ['JWT_SECRET_KEY', 'CHAVE_JWT'],
  PORT: ['PORTA'],
};

// ─── Leitura segura ────────────────────────────────────────────────────────────

/**
 * Lê e sanitiza uma variável de ambiente.
 * Retorna `undefined` se vazia ou composta só de espaços.
 *
 * @param key Nome da variável de ambiente.
 * @returns Valor trimado ou `undefined`.
 */
function readEnvValue(key: string) {
  const value = process.env[key];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

// ─── Normalização ──────────────────────────────────────────────────────────────

/**
 * Preenche variáveis canônicas a partir de aliases caso ainda não estejam definidas.
 * Idempotente: chamadas múltiplas não sobrescrevem valores já populados.
 *
 * @returns `void`.
 */
export function normalizeEnv() {
  for (const [target, aliases] of Object.entries(ENV_ALIASES)) {
    // Se o nome canônico já tem valor, não sobrescreve.
    if (readEnvValue(target)) continue;

    // Percorre aliases em ordem; usa o primeiro que tiver valor.
    for (const alias of aliases) {
      const value = readEnvValue(alias);
      if (value) {
        process.env[target] = value;
        break;
      }
    }
  }
}
