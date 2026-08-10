/**
 * bootstrap.ts
 *
 * Inicialização de dados obrigatórios do backend SPI.
 *
 * Cria usuários seed (admin + SEED_USERS_JSON) se ainda não existirem no banco.
 * Autenticação é por e-mail + telefone — sem senha.
 *
 * Variáveis de ambiente para o admin:
 *  - ADMIN_EMAIL    → e-mail do administrador
 *  - ADMIN_PHONE    → telefone do administrador (somente dígitos)
 *  - ADMIN_NAME     → nome (padrão: "Admin")
 */
import { prisma } from './database/prisma.js';
import { seedUsers } from './config/seedUsers.js';
import { normalizeEnv } from './config/env.js';

function getSeedUsers() {
  const users = [...seedUsers];
  const email = process.env.ADMIN_EMAIL;
  const phone = process.env.ADMIN_PHONE?.replace(/\D/g, '');
  const name = process.env.ADMIN_NAME || 'Admin';

  if (email && phone && !users.some((u) => u.email === email)) {
    users.push({ name, email, phone, marketplace: undefined });
  }

  return users;
}

export async function ensureSeedUsers() {
  normalizeEnv();

  const users = getSeedUsers();
  if (!users.length) return;

  for (const user of users) {
    const existing = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!existing) {
      const isAdmin = user.email === process.env.ADMIN_EMAIL;
      await prisma.user.create({
        data: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          marketplace: user.marketplace,
          isAdmin,
        },
      });
      console.log(`Seed user created: ${user.email}${isAdmin ? ' [admin]' : ''}`);
    } else if (user.email === process.env.ADMIN_EMAIL && !existing.isAdmin) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { isAdmin: true },
      });
    }
  }
}
