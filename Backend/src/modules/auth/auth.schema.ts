/**
 * modules/auth/auth.schema.ts
 *
 * Schemas de validação Zod para o módulo de autenticação.
 *
 * Regras:
 *  - `name`: ao menos 2 caracteres.
 *  - `phone`: entre 10 e 11 dígitos numéricos (aceita formatado ou cru).
 *  - `confirmPhone`: deve ser igual a `phone`.
 *  - `email`: formato RFC válido.
 *  - `marketplace`: string não vazia indicando onde o usuário vende.
 *  - `refreshToken`: string não vazia (presença; conteúdo verificado no serviço).
 */
import { z } from 'zod';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Remove tudo que não for dígito para normalização e validação de telefone. */
const digitsOnly = (v: string) => v.replace(/\D/g, '');

const phoneField = z
  .string()
  .min(1, 'Telefone obrigatório')
  .refine(
    (v) => {
      const d = digitsOnly(v);
      return d.length >= 10 && d.length <= 11;
    },
    { message: 'Telefone inválido. Use DDD + número (ex.: 11 99999-9999).' }
  );

// ─── Schemas ───────────────────────────────────────────────────────────────────

export const registerSchema = z
  .object({
    name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
    phone: phoneField,
    confirmPhone: z.string().min(1, 'Confirmação de telefone obrigatória'),
    email: z.string().email('E-mail inválido'),
    marketplace: z.string().min(1, 'Selecione um marketplace'),
  })
  .refine((data) => digitsOnly(data.phone) === digitsOnly(data.confirmPhone), {
    message: 'Os telefones não coincidem',
    path: ['confirmPhone'],
  });

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  phone: phoneField,
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

/** Utilitário exportado para normalização consistente em service e repository. */
export const normalizePhone = (phone: string) => digitsOnly(phone);
