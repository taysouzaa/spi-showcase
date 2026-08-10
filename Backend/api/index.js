/**
 * Entry point serverless (Vercel Functions).
 * Reaproveita a aplicação compilada em `dist`, executando seed apenas uma vez por instância.
 */
import { app } from '../dist/app.js';
import { ensureSeedUsers } from '../dist/bootstrap.js';
import { normalizeEnv } from '../dist/config/env.js';

normalizeEnv();

let seedPromise = null;

async function seedOnce() {
  /**
   * Executa seed de usuários com memoização para evitar repetição por requisição.
   * @returns Promise do processo de seed.
   */
  if (!seedPromise) {
    seedPromise = ensureSeedUsers().catch((error) => {
      console.error('Failed to ensure seed users', error);
    });
  }
  await seedPromise;
}

export default async function handler(req, res) {
  /**
   * @param req Requisição HTTP da função serverless.
   * @param res Resposta HTTP da função serverless.
   * @returns Encaminha fluxo para o app Express.
   */
  await seedOnce();
  app(req, res);
}
