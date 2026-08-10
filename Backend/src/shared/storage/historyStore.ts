/**
 * shared/storage/historyStore.ts
 *
 * Repositório de histórico em arquivo local — fallback ao banco de dados.
 *
 * O que este arquivo faz:
 *  - Persiste registros de imagens processadas em `data/history.json` no servidor.
 *  - Oferece operações CRUD por usuário: adicionar, listar, buscar, atualizar e remover.
 *  - É utilizado como fallback pelo `HistoryController` quando o Prisma/PostgreSQL não está
 *    disponível (banco fora do ar, ambiente de desenvolvimento sem DB configurado, etc.).
 *
 * Por que ter um fallback em arquivo?
 *  - Permite que a aplicação funcione parcialmente mesmo sem banco de dados.
 *  - Facilita testes locais e demos sem necessidade de configurar PostgreSQL.
 *  - Dados em arquivo são perdidos em deployments serverless; para produção, o Prisma é preferido.
 *
 * Limitações:
 *  - Não é thread-safe para múltiplos processos simultâneos (OK para instância única).
 *  - Sem índices: `listImages` percorre toda a lista a cada chamada (adequado para volumes pequenos).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export type StoredImage = {
  id: string;
  userId: string;
  fileName: string;
  finalName: string;
  storedFileName: string;
  mimeType: string;
  marketplace: string;
  width: number;
  height: number;
  s3Key?: string;
  s3Url?: string;
  createdAt: string;
};

// ─── Configuração de armazenamento ─────────────────────────────────────────────

// Arquivo de persistência relativo à raiz do projeto (onde o servidor é iniciado).
const storePath = path.resolve('data', 'history.json');

// ─── Operações internas de I/O ─────────────────────────────────────────────────

/**
 * Garante que o diretório `data/` exista antes de tentar escrever.
 * @returns `Promise<void>`.
 */
async function ensureStore() {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
}

/**
 * Lê todos os registros do arquivo de histórico.
 * Retorna lista vazia em caso de arquivo inexistente ou JSON inválido.
 *
 * @returns Lista completa de imagens armazenadas.
 */
const MAX_HISTORY_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

async function readStore(): Promise<StoredImage[]> {
  try {
    const stat = await fs.stat(storePath);
    if (stat.size > MAX_HISTORY_FILE_BYTES) {
      console.warn('[historyStore] history.json excede o limite de tamanho, retornando vazio');
      return [];
    }
    const raw = await fs.readFile(storePath, 'utf-8');
    return JSON.parse(raw) as StoredImage[];
  } catch {
    // Arquivo ausente ou corrompido: trata como lista vazia em vez de lançar erro.
    return [];
  }
}

/**
 * Substitui o conteúdo completo do arquivo de histórico.
 * @param items Lista completa de imagens a persistir.
 * @returns `Promise<void>`.
 */
async function writeStore(items: StoredImage[]) {
  await ensureStore();
  await fs.writeFile(storePath, JSON.stringify(items, null, 2));
}

// ─── Operações públicas CRUD ───────────────────────────────────────────────────

/**
 * Insere uma nova imagem no início da lista (mais recente primeiro).
 *
 * @param input Dados da imagem sem os campos gerados pelo sistema (`id` e `createdAt`).
 * @returns Item criado com `id` (UUID v4) e `createdAt` (ISO 8601).
 */
export async function addImage(input: Omit<StoredImage, 'id' | 'createdAt'>) {
  const items = await readStore();
  const item: StoredImage = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  items.unshift(item);
  await writeStore(items);
  return item;
}

/**
 * Lista todas as imagens de um usuário específico.
 *
 * @param userId Identificador do usuário dono das imagens.
 * @returns Lista filtrada de imagens do usuário.
 */
export async function listImages(userId: string) {
  const items = await readStore();
  return items.filter((item) => item.userId === userId);
}

/**
 * Busca uma imagem por ID e usuário.
 *
 * @param id Identificador da imagem.
 * @param userId Identificador do usuário (impede acesso cruzado entre contas).
 * @returns Item encontrado ou `null`.
 */
export async function findImage(id: string, userId: string) {
  const items = await readStore();
  return items.find((item) => item.id === id && item.userId === userId) || null;
}

/**
 * Atualiza campos parciais de uma imagem existente.
 *
 * @param id Identificador da imagem.
 * @param userId Identificador do usuário (garante escopo).
 * @param updates Campos a sobrescrever (mesclados via spread).
 * @returns Item atualizado ou `null` se não encontrado.
 */
export async function updateImage(
  id: string,
  userId: string,
  updates: Partial<StoredImage>
) {
  const items = await readStore();
  const index = items.findIndex(
    (item) => item.id === id && item.userId === userId
  );
  if (index === -1) return null;
  items[index] = { ...items[index], ...updates };
  await writeStore(items);
  return items[index];
}

/**
 * Remove uma imagem da lista pelo ID e usuário.
 *
 * @param id Identificador da imagem.
 * @param userId Identificador do usuário.
 * @returns Item removido ou `null` se não encontrado.
 */
export async function removeImage(id: string, userId: string) {
  const items = await readStore();
  const index = items.findIndex(
    (item) => item.id === id && item.userId === userId
  );
  if (index === -1) return null;
  const [removed] = items.splice(index, 1);
  await writeStore(items);
  return removed;
}

/**
 * Remove todas as imagens de um usuário.
 *
 * @param userId Identificador do usuário.
 * @returns Quantidade de registros removidos.
 */
export async function clearImages(userId: string) {
  const items = await readStore();
  const remaining = items.filter((item) => item.userId !== userId);
  const removedCount = items.length - remaining.length;
  if (removedCount > 0) {
    await writeStore(remaining);
  }
  return removedCount;
}
