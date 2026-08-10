/**
 * config/seedUsers.ts
 *
 * Fonte de usuários seed via variável de ambiente SEED_USERS_JSON.
 *
 * Formato esperado em SEED_USERS_JSON:
 *  [
 *    { "name": "Alice", "email": "alice@example.com", "phone": "11999999999", "marketplace": "amazon" },
 *    { "name": "Bob",   "email": "bob@example.com",   "phone": "21988887777" }
 *  ]
 */
export type SeedUser = {
  name: string;
  email: string;
  phone: string;
  marketplace?: string;
};

function parseSeedUsers(): SeedUser[] {
  const raw = process.env.SEED_USERS_JSON?.trim();
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('SEED_USERS_JSON inválido: esperado JSON válido.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('SEED_USERS_JSON inválido: esperado um array de usuários.');
  }

  const users: SeedUser[] = [];
  const seenEmails = new Set<string>();

  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;

    const candidate = item as Partial<SeedUser>;

    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const email =
      typeof candidate.email === 'string'
        ? candidate.email.trim().toLowerCase()
        : '';
    const phone =
      typeof candidate.phone === 'string'
        ? candidate.phone.trim().replace(/\D/g, '')
        : '';
    const marketplace =
      typeof candidate.marketplace === 'string' ? candidate.marketplace.trim() : undefined;

    if (!name || !email || !phone) continue;
    if (seenEmails.has(email)) continue;

    seenEmails.add(email);
    users.push({ name, email, phone, marketplace });
  }

  return users;
}

export const seedUsers: SeedUser[] = parseSeedUsers();
