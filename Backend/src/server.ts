/**
 * server.ts
 *
 * Ponto de entrada do backend SPI em ambiente Node tradicional (não-serverless).
 *
 * O que este arquivo faz:
 *  - Carrega variáveis de ambiente (.env e src/.env) antes de qualquer outro import.
 *  - Normaliza aliases de variáveis em português/legado para os nomes canônicos.
 *  - Garante criação dos usuários seed (admin e outros definidos em SEED_USERS_JSON).
 *  - Inicializa o servidor HTTP na porta configurada (padrão: 3333).
 *  - Registra handlers de SIGINT/SIGTERM para encerramento gracioso.
 *
 * Por que o seed acontece antes de `app.listen`?
 *  - Evita que requisições cheguem antes de o banco estar em estado consistente.
 *  - Se o seed falhar, o servidor ainda sobe para não bloquear ambientes de desenvolvimento.
 */
import 'dotenv/config';
import path from 'node:path';
import dotenv from 'dotenv';
import { app } from './app.js';
import { normalizeEnv } from './config/env.js';
import { ensureSeedUsers } from './bootstrap.js';

// ─── Variáveis de ambiente ─────────────────────────────────────────────────────

// Carrega duas vezes para cobrir projetos com .env na raiz E dentro de src/.
// A segunda chamada não sobrescreve valores já definidos (dotenv respeita isso por padrão).
dotenv.config();
dotenv.config({ path: path.resolve('src/.env') });

// Converte aliases em português para os nomes canônicos antes de qualquer leitura de config.
normalizeEnv();

// ─── Inicialização ─────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 3333;

ensureSeedUsers()
  .catch((error) => {
    // Falha no seed é registrada mas não impede o servidor de subir.
    // Em produção, o admin pode ser criado manualmente ou via variáveis de ambiente.
    console.error('Failed to ensure seed users', error);
  })
  .finally(() => {
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // ─── Encerramento gracioso ─────────────────────────────────────────────────
    // `server.close` aguarda requisições em andamento terminarem antes de fechar.
    // Sem isso, um restart/deploy poderia cortar conexões ativas abruptamente.
    process.on('SIGINT', () => {
      server.close(() => process.exit(0));
    });

    process.on('SIGTERM', () => {
      server.close(() => process.exit(0));
    });
  });
