/**
 * shared/utils/withTimeout.ts
 *
 * Utilitário para limitar o tempo máximo de operações assíncronas.
 *
 * O que este arquivo faz:
 *  - Envolve qualquer `Promise` em uma corrida com um timer de timeout.
 *  - Se a operação não terminar dentro de `timeoutMs`, lança `AppError` com o código HTTP fornecido.
 *  - Se `timeoutMs` for inválido (≤ 0 ou não finito), executa a operação sem limite de tempo.
 *
 * Por que isso é necessário?
 *  - Chamadas à Google Drive API podem travar por tempo indeterminado em instabilidades de rede.
 *    Sem timeout, a requisição do frontend ficaria pendente até o socket fechar (minutos).
 *  - `withTimeout` garante que o backend sempre responda dentro de um tempo previsível.
 *
 * Por que o flag `settled`?
 *  - Evita que `resolve` e `reject` sejam chamados duas vezes caso a Promise resolva e o
 *    timeout dispare quase simultaneamente (condição de corrida no event loop).
 *
 * Uso:
 *  const resultado = await withTimeout(
 *    () => driveService.uploadFile(params),
 *    30000,
 *    'Timeout ao enviar imagem para o Google Drive'
 *  );
 */
import { AppError } from '../errors/AppError.js';

/**
 * Executa uma operação assíncrona com tempo limite.
 *
 * @param operation Função que retorna a Promise a ser executada.
 * @param timeoutMs Tempo limite em milissegundos. Valores ≤ 0 desativam o timeout.
 * @param timeoutMessage Mensagem de erro retornada ao cliente em caso de timeout.
 * @param statusCode Código HTTP do erro de timeout (padrão: 504 Gateway Timeout).
 * @returns Resultado da operação se completar antes do limite.
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
  statusCode = 504
): Promise<T> {
  // Timeout inválido ou desativado: executa sem limitação de tempo.
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return operation();
  }

  return new Promise<T>((resolve, reject) => {
    // Flag para garantir que apenas uma das duas saídas (sucesso ou timeout) seja processada.
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new AppError(timeoutMessage, statusCode));
    }, timeoutMs);

    operation()
      .then((value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        reject(error);
      })
      .finally(() => {
        // Sempre limpa o timer ao terminar, mesmo em sucesso, para evitar vazamento de recursos.
        clearTimeout(timer);
      });
  });
}
