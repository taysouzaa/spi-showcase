/**
 * shared/utils/concurrencyLimiter.ts
 *
 * Controle de concorrência com fila em memória para o backend SPI.
 *
 * O que este arquivo faz:
 *  - Limita o número de operações assíncronas executadas simultaneamente (`maxConcurrent`).
 *  - Enfileira tarefas excedentes até que um slot fique disponível.
 *  - Limita o tamanho da fila para evitar acúmulo ilimitado em picos de carga (`maxQueueSize`).
 *  - Aplica timeout individual a cada item na fila — se não sair da fila a tempo, rejeita com 503.
 *
 * Por que isso é necessário?
 *  - O Google Drive API tem quotas e a instância de backend pode ter poucos recursos.
 *    Processar 50 uploads simultâneos poderia sobrecarregar a API e o servidor.
 *  - Com o limiter, uploads extras esperam na fila e são processados quando um slot abre.
 *  - O timeout de fila (`queueTimeoutMs`) evita que o cliente espere indefinidamente.
 *
 * Uso típico no ImageController:
 *  const limiter = new ConcurrencyLimiter(2, 10);
 *  const resultado = await limiter.run(() => driveService.uploadFile(...));
 */
import { AppError } from '../errors/AppError.js';

// ─── Tipos internos ────────────────────────────────────────────────────────────

type QueueItem<T> = {
  task: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  timer?: NodeJS.Timeout;  // Timer de timeout individual do item na fila.
};

type RunOptions = {
  queueTimeoutMs?: number;    // Tempo máximo que um item pode aguardar na fila.
  overflowMessage?: string;   // Mensagem retornada quando a fila está cheia.
};

// ─── Implementação ─────────────────────────────────────────────────────────────

export class ConcurrencyLimiter {
  private active = 0;  // Quantidade de tarefas sendo executadas agora.
  private queue: Array<QueueItem<unknown>> = [];  // Fila de espera.

  /**
   * @param maxConcurrent Máximo de tarefas rodando ao mesmo tempo.
   * @param maxQueueSize Máximo de tarefas aguardando na fila.
   */
  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueueSize: number
  ) {}

  /**
   * Enfileira ou executa imediatamente a tarefa conforme disponibilidade de slots.
   *
   * @param task Operação assíncrona a executar.
   * @param options Configurações de timeout e mensagem de overflow.
   * @returns Promise com o resultado da tarefa.
   */
  run<T>(task: () => Promise<T>, options?: RunOptions): Promise<T> {
    const queueTimeoutMs = options?.queueTimeoutMs ?? 15000;
    const overflowMessage =
      options?.overflowMessage ||
      'Servidor ocupado processando imagens. Tente novamente em instantes.';

    // Slot disponível: executa imediatamente sem enfileirar.
    if (this.active < this.maxConcurrent) {
      return this.execute(task);
    }

    // Fila cheia: rejeita imediatamente em vez de acumular infinitamente.
    // Isso protege o servidor de filas enormes em picos de requisições simultâneas.
    if (this.queue.length >= this.maxQueueSize) {
      console.warn(
        `[concurrency] Queue overflow: active=${this.active} queued=${this.queue.length}`
      );
      throw new AppError(overflowMessage, 503);
    }

    // Enfileira a tarefa e registra timer de timeout individual.
    return new Promise<T>((resolve, reject) => {
      const queueItem: QueueItem<T> = { task, resolve, reject };

      if (queueTimeoutMs > 0) {
        queueItem.timer = setTimeout(() => {
          // Remove da fila se ainda estiver esperando quando o timeout disparar.
          const index = this.queue.indexOf(queueItem as QueueItem<unknown>);
          if (index >= 0) {
            this.queue.splice(index, 1);
          }
          console.warn(
            `[concurrency] Queue timeout: active=${this.active} queued=${this.queue.length}`
          );
          reject(
            new AppError(
              'Tempo de espera excedido na fila de processamento. Tente novamente.',
              503
            )
          );
        }, queueTimeoutMs);
      }

      this.queue.push(queueItem as QueueItem<unknown>);
    });
  }

  /**
   * Executa a tarefa contabilizando slots ativos e disparando `drain` ao concluir.
   *
   * @param task Operação assíncrona.
   * @returns Promise com resultado da tarefa.
   */
  private execute<T>(task: () => Promise<T>): Promise<T> {
    this.active += 1;

    return Promise.resolve()
      .then(task)
      .finally(() => {
        this.active -= 1;
        // Quando um slot libera, tenta processar o próximo item da fila.
        this.drain();
      });
  }

  /**
   * Processa itens da fila enquanto houver slots disponíveis.
   * Chamado automaticamente ao concluir cada tarefa.
   */
  private drain() {
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) return;

      // Cancela o timer de timeout do item que está saindo da fila.
      if (next.timer) {
        clearTimeout(next.timer);
      }

      this.execute(next.task)
        .then((value) => next.resolve(value))
        .catch((error) => next.reject(error));
    }
  }
}
