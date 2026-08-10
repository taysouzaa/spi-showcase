-- Migration: 001_phone_auth
-- Troca autenticação por senha para autenticação por e-mail + telefone.
-- Remove o campo `password` e adiciona `phone` e `marketplace` em `User`.

-- Adiciona `phone` com valor temporário para não violar NOT NULL em dados existentes.
ALTER TABLE "User" ADD COLUMN "phone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "marketplace" TEXT;

-- Remove o default temporário após preenchimento.
ALTER TABLE "User" ALTER COLUMN "phone" DROP DEFAULT;

-- Remove a coluna de senha (irreversível — faça backup antes).
ALTER TABLE "User" DROP COLUMN "password";
