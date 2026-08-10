/**
 * MultipleUploadArea.tsx
 *
 * Componente de área de upload em lote com suporte a drag-and-drop.
 *
 * O que este arquivo faz:
 *  - Exibe uma área clicável e com suporte a arrastar-e-soltar arquivos.
 *  - Valida os arquivos antes de passá-los para a fila de processamento:
 *      1. Verifica se são imagens (pelo tipo MIME ou pela extensão).
 *      2. Rejeita arquivos maiores que 15 MB (mesmo limite do backend).
 *      3. Respeita o limite máximo de arquivos por vez (padrão: 10).
 *  - Exibe mensagens de erro visíveis quando alguma validação falha.
 *  - Não faz nenhum upload; apenas entrega os arquivos válidos via onFilesSelect.
 */
import { useCallback, useState } from 'react';
import type React from 'react';
import { motion } from 'framer-motion';
import { Upload, AlertCircle } from 'lucide-react';

// ─── Constantes de validação ────────────────────────────────────────────────
// Limite de tamanho igual ao configurado no backend (multer).
// Se mudar aqui, mude também em images.routes.ts no backend.
const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024; // 15 MB em bytes

// Lista de extensões de imagem aceitas (complementa a verificação pelo tipo MIME).
// Usada como fallback quando o navegador não preenche file.type corretamente.
const IMAGE_EXTENSIONS = new Set([
  'avif',
  'bmp',
  'gif',
  'heic',
  'heif',
  'ico',
  'jfif',
  'jpg',
  'jpeg',
  'pjp',
  'pjpeg',
  'png',
  'svg',
  'tif',
  'tiff',
  'webp',
]);

// ─── Verificação de tipo de arquivo ─────────────────────────────────────────
// Aceita o arquivo se o tipo MIME começar com "image/" OU se a extensão
// estiver na lista acima. O duplo cheque cobre casos em que o OS não
// preenche o MIME type corretamente (ex: arquivos HEIC no Windows).
const isImageFile = (file: File) => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (file.type && file.type.startsWith('image/')) return true;
  return ext ? IMAGE_EXTENSIONS.has(ext) : false;
};

// ─── Tipos das props ─────────────────────────────────────────────────────────
interface MultipleUploadAreaProps {
  // Chamada pelo pai (ProcessorView) ao receber arquivos válidos.
  onFilesSelect: (files: File[]) => void;
  // Quantos arquivos podem ser enviados ao mesmo tempo. Padrão: 10.
  maxFiles?: number;
  // Quando true, desabilita toda interação (usado enquanto há processamento ativo).
  disabled?: boolean;
}

export function MultipleUploadArea({
  onFilesSelect,
  maxFiles = 10,
  disabled,
}: MultipleUploadAreaProps) {
  // ─── Estado local ──────────────────────────────────────────────────────────
  // isDragging: controla o estilo visual enquanto o usuário está arrastando arquivos.
  const [isDragging, setIsDragging] = useState(false);
  // error: mensagem de validação exibida por 4 segundos e depois limpa.
  const [error, setError] = useState<string>('');

  // ─── Validação de arquivos ────────────────────────────────────────────────
  // Executado tanto no drop quanto na seleção via clique.
  // A ordem das validações importa: filtramos por tipo primeiro, depois tamanho,
  // depois quantidade — para que a mensagem de erro seja a mais específica possível.
  const validateFiles = useCallback(
    (files: File[]): { valid: File[]; error?: string } => {
      // 1. Filtra apenas imagens. Arquivos não-imagem são ignorados silenciosamente
      //    se houver outros válidos, ou geram erro se a seleção inteira for inválida.
      const validFiles = files.filter(isImageFile);
      const ignoredCount = files.length - validFiles.length;

      if (validFiles.length === 0) {
        return {
          valid: [],
          error: 'Apenas arquivos de imagem são aceitos (JPG, PNG, WEBP, etc.)',
        };
      }

      // 2. Rejeita arquivos acima do limite de 15 MB.
      //    Bloqueia toda a seleção para evitar que o usuário envie parte dos arquivos
      //    e fique confuso sobre quais foram aceitos.
      const oversized = validFiles.filter((f) => f.size > MAX_FILE_SIZE);
      if (oversized.length > 0) {
        return {
          valid: [],
          error: `${oversized.length} arquivo(s) maior(es) que ${MAX_FILE_SIZE_MB}MB não são aceitos.`,
        };
      }

      // 3. Se houver mais arquivos do que o limite, aceita apenas os primeiros
      //    e avisa o usuário quantos foram ignorados.
      if (validFiles.length > maxFiles) {
        return {
          valid: validFiles.slice(0, maxFiles),
          error: `Limite de ${maxFiles} imagens excedido. Apenas as primeiras ${maxFiles} foram selecionadas.`,
        };
      }

      // 4. Avisa quando parte dos arquivos selecionados não eram imagens,
      //    mas ainda entrega os que são válidos.
      if (ignoredCount > 0) {
        return {
          valid: validFiles,
          error: `${ignoredCount} arquivo(s) ignorado(s) por não serem imagem.`,
        };
      }

      return { valid: validFiles };
    },
    [maxFiles]
  );

  // ─── Handler: soltar arquivos na área (drag-and-drop) ────────────────────
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      setError('');

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      const { valid, error: validationError } = validateFiles(files);

      if (validationError) {
        setError(validationError);
        // Limpa a mensagem de erro automaticamente após 4 segundos.
        setTimeout(() => setError(''), 4000);
      }

      if (valid.length > 0) {
        onFilesSelect(valid);
      }
    },
    [disabled, onFilesSelect, validateFiles]
  );

  // ─── Handler: selecionar arquivos pelo input nativo (clique) ─────────────
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError('');

      if (!e.target.files || disabled) return;

      const files = Array.from(e.target.files);
      const { valid, error: validationError } = validateFiles(files);

      if (validationError) {
        setError(validationError);
        setTimeout(() => setError(''), 4000);
      }

      if (valid.length > 0) {
        onFilesSelect(valid);
      }

      // Limpa o valor do input para permitir selecionar o mesmo arquivo novamente.
      e.target.value = '';
    },
    [disabled, onFilesSelect, validateFiles]
  );

  // ─── Handler: usuário está arrastando sobre a área (ativa estilo visual) ──
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragging(true);
    },
    [disabled]
  );

  // ─── Handler: usuário saiu da área de drop (remove estilo visual) ─────────
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // ─── Renderização ─────────────────────────────────────────────────────────
  return (
    <div className="w-full flex flex-col flex-1">
      {/*
        Área principal de drop.
        - Muda a borda e o fundo quando há erro.
        - Cresce levemente ao passar o mouse (scale: 1.01) via Framer Motion.
        - O input de arquivo fica transparente e cobre toda a área,
          tornando qualquer clique um clique no input.
      */}
      <motion.div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        whileHover={!disabled ? { scale: 1.01 } : {}}
        className={`
          relative rounded-2xl p-4 sm:p-6 md:p-10 text-center transition-all duration-300 upload-drop flex-1 flex flex-col items-center justify-center
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isDragging ? 'is-active' : ''}
        `}
        style={{
          borderColor: error ? 'rgba(239, 68, 68, 0.5)' : undefined,
          backgroundColor: error ? 'rgba(239, 68, 68, 0.08)' : undefined,
        }}
      >
        {/* Input invisível que cobre toda a área e captura os cliques */}
        <input
          type="file"
          multiple
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/bmp,image/svg+xml,image/tiff,image/avif,image/heic"
          onChange={handleFileInput}
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        />

        {/* Ícone central: alterna entre upload e erro conforme o estado */}
        <motion.div
          animate={{
            scale: isDragging ? 1.1 : 1,
            rotate: isDragging ? 5 : 0,
          }}
          transition={{ duration: 0.2 }}
          className="inline-flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 rounded-2xl mb-4 sm:mb-5"
          style={{
            backgroundColor: error
              ? 'rgba(239, 68, 68, 0.15)'
              : 'rgba(124, 255, 78, 0.16)',
          }}
        >
          {error ? (
            <AlertCircle className="w-7 h-7 sm:w-10 sm:h-10" style={{ color: '#EF4444' }} />
          ) : (
            <Upload className="w-7 h-7 sm:w-10 sm:h-10" style={{ color: '#7CFF4E' }} />
          )}
        </motion.div>

        {/* Texto principal: muda quando o usuário está arrastando */}
        <h3 className="text-gray-100 text-lg sm:text-xl font-semibold mb-2">
          {isDragging
            ? 'Solte as imagens aqui'
            : 'Arraste imagens ou clique para selecionar'}
        </h3>

        <p className="text-muted text-xs sm:text-sm font-normal mb-4">
          Formatos aceitos: JPG, PNG, WEBP e outros formatos de imagem
        </p>

        {/* Informações de limites exibidas abaixo do texto principal */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-xs text-gray-400 font-normal">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: '#7CFF4E' }}
            />
            Até {maxFiles} imagens por vez
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: '#7CFF4E' }}
            />
            Máx. {MAX_FILE_SIZE_MB}MB por arquivo
          </div>
        </div>

        {/* Mensagem de erro com animação de entrada — aparece e desaparece automaticamente */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 px-4 py-3 rounded-lg flex items-center gap-2"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }}
          >
            <AlertCircle
              className="w-4 h-4 flex-shrink-0"
              style={{ color: '#FCA5A5' }}
            />
            <p className="text-sm font-medium" style={{ color: '#FCA5A5' }}>
              {error}
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
