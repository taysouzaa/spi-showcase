/**
 * database/prisma.ts
 *
 * Instância singleton do Prisma Client.
 *
 * O que este arquivo faz:
 *  - Carrega variáveis de ambiente antes de instanciar o cliente (garante DATABASE_URL disponível).
 *  - Normaliza aliases de variáveis em português para os nomes canônicos do Prisma.
 *  - Exporta uma única instância compartilhada por toda a aplicação.
 *
 * Por que singleton?
 *  - O Prisma Client mantém um pool de conexões internas; múltiplas instâncias criariam
 *    pools duplicados, desperdiçando recursos e podendo esgotar conexões do banco.
 *  - Importar sempre do mesmo módulo garante que Node.js reutilize a instância em cache.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { normalizeEnv } from '../config/env.js';

// Normalização antes da instância: o Prisma lê DATABASE_URL no construtor.
normalizeEnv();

export const prisma = new PrismaClient();
