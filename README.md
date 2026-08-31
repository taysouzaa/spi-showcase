# SPI — Sistema de Processamento de Imagens

> Padronize imagens de produtos para marketplaces automaticamente — fundo branco, dimensões exatas, processamento 100% local no navegador.

![Versão](https://img.shields.io/badge/versão-2.0.0-22c55e?style=flat-square)
![Node](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![AWS](https://img.shields.io/badge/AWS-Amplify%20%2B%20EC2%20%2B%20RDS%20%2B%20S3-FF9900?style=flat-square&logo=amazonaws)
[![CI](https://github.com/taysouzaa/spi-showcase/actions/workflows/ci.yml/badge.svg)](https://github.com/taysouzaa/spi-showcase/actions/workflows/ci.yml)
![Licença](https://img.shields.io/badge/licença-proprietária-red?style=flat-square)

---

> **Estado:** ativo · **Última revisão:** 2026-08-10

> **Sobre este repositório.** É a versão pública do SPI, sistema que desenvolvi para o **Método P4**, consultoria especializada em marketplaces. O código é o mesmo que roda em produção; o que mudou foram os valores de infraestrutura — nome de bucket, domínios e identificador de conta aparecem como exemplos genéricos. O desenvolvimento vem de janeiro de 2026; o histórico completo fica em repositório privado.

## Visão geral

O **SPI** é uma plataforma SaaS para padronização de imagens de produtos para os principais marketplaces brasileiros. O usuário faz upload de uma imagem, seleciona o marketplace de destino e o sistema redimensiona, centraliza e aplica fundo branco automaticamente — tudo processado no navegador via Canvas API, sem enviar a imagem original a nenhum servidor.

### A decisão que define o projeto

O processamento acontece **no navegador**, não no servidor. A imagem original nunca sai da máquina do usuário: o Canvas API redimensiona, centraliza e aplica o fundo branco, e só o resultado final vai para o S3.

Isso troca custo de servidor por trabalho no cliente, elimina o upload da imagem bruta e resolve a objeção de quem manda foto de produto que ainda não foi lançado. O backend cuida do que precisa de confiança: autenticação, histórico e gestão de usuários.

**Demo ao vivo:** https://spi.metodop4.com.br

---

## Funcionalidades

- **Processamento local** — Canvas API, a imagem original nunca sai do navegador
- **6 marketplaces** — Amazon, Mercado Livre, Shopee, Magazine Luiza, Shein, TikTok Shop
- **Dimensões exatas** — estratégia contain/letterbox com fundo branco puro (#FFFFFF)
- **Alta qualidade** — downscale progressivo + `imageSmoothingQuality: 'high'`
- **Histórico** — imagens processadas salvas no backend com links S3
- **Download em lote** — ZIP com todas as imagens processadas da sessão
- **Autenticação sem senha** — e-mail + telefone, JWT com access (15min) + refresh (30d)
- **Painel administrativo** — criação e gestão de usuários, bloqueio de contas
- **Captura de leads** — integração n8n → Google Sheets
- **SEO completo** — meta tags, Open Graph, Twitter Card, sitemap, robots.txt

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite 6 + TypeScript + Tailwind CSS |
| Backend | Node.js 20 + Express + Prisma ORM |
| Banco de dados | PostgreSQL (AWS RDS — us-east-1) |
| Armazenamento | AWS S3 (`seu-bucket-de-imagens` — sa-east-1) |
| Deploy frontend | AWS Amplify (us-east-2) |
| Deploy backend | AWS EC2 t3.micro + Nginx + PM2 (us-east-1) |
| SSL | Let's Encrypt (Certbot) |

---

## Estrutura do projeto

```
SPI/
├── Frontend/                  # React + Vite
│   ├── src/
│   │   ├── app/               # App.tsx — roteamento de views
│   │   ├── features/
│   │   │   ├── auth/          # LoginScreen (e-mail + telefone)
│   │   │   ├── processing/    # ProcessorView — canvas resize + upload S3
│   │   │   ├── history/       # HistoryPanel — histórico paginado
│   │   │   └── admin/         # AdminPanel — gestão de usuários
│   │   └── shared/
│   │       ├── constants.ts   # Chaves de localStorage centralizadas
│   │       ├── hooks/         # useAuth, useHistory
│   │       ├── services/      # api.ts, fetchWithAuth
│   │       └── utils/         # marketplaceRules
│   └── public/
│       ├── config.js          # Runtime config (sobrescrito pelo VITE_API_URL)
│       ├── robots.txt
│       └── sitemap.xml
│
└── Backend/                   # Node.js + Express
    ├── src/
    │   ├── modules/
    │   │   ├── auth/          # login (e-mail + telefone), refresh, logout
    │   │   ├── images/        # upload S3, histórico
    │   │   ├── history/       # CRUD histórico paginado
    │   │   └── leads/         # captura de leads
    │   ├── middlewares/       # auth, ensureAdmin, error, rate limit
    │   └── config/            # env, jwt, paths
    └── prisma/
        └── schema.prisma      # User, ProcessedImage, Lead
```

---

## Dimensões por Marketplace

| Marketplace | Largura | Altura | Fundo |
|-------------|---------|--------|-------|
| Amazon | 1000px | 1000px | Branco puro |
| Mercado Livre | 1200px | 1200px | Branco |
| Shopee | 1024px | 1024px | Branco |
| Magazine Luiza | 1000px | 1000px | Branco puro |
| Shein | 1500px | 2000px | Branco (proporção 3:4) |
| TikTok Shop | 800px | 800px | Branco |

---

## Qualidade

Cada push e cada pull request na `main` roda [`.github/workflows/ci.yml`](.github/workflows/ci.yml):
testes e build do Backend, typecheck e build do Frontend. O pipeline não precisa de
secret nenhum — os testes usam variáveis fake de `Backend/vitest.config.ts` e o Prisma
é mockado, então nada toca a AWS nem o banco.

```bash
cd Backend
npm test              # vitest run
npm run test:coverage # relatório de cobertura
```

**16 casos cobrindo o que quebra silenciosamente:**

| Suite | O que protege |
|---|---|
| `auth.test.ts` | Registro duplicado (409), telefone e e-mail incorretos no login (401) e indisponibilidade do banco (503) |
| `middlewares.test.ts` | `ensureAuth`: token ausente ou inválido (401), usuário bloqueado (403) e **fail-closed** quando o banco cai (503, nunca libera acesso) |
| `history.pagination.test.ts` | Teto de `limit` em 100, defaults de paginação e cálculo de `totalPages` / `skip` |

A cobertura é deliberadamente estreita: mira autenticação, autorização e os limites de
paginação — onde uma regressão vaza dado ou derruba a instância. O processamento de
imagem em si roda no navegador e é verificado visualmente.

---

## Rodar local

### Pré-requisitos

- Node.js 20+
- PostgreSQL (local ou acesso ao RDS)
- Conta AWS com bucket S3

### Backend

```bash
cd Backend
npm install
cp .env.example .env   # preencha com suas credenciais
npx prisma migrate deploy
npm run dev            # http://localhost:3333
```

### Frontend

```bash
cd Frontend
npm install
# .env já configurado com VITE_API_URL=http://localhost:3333
npm run dev            # http://localhost:5173
```

---

## Variáveis de Ambiente (Backend)

```env
DATABASE_URL=postgresql://usuario:senha@host:5432/spiv2?sslmode=require
DIRECT_URL=postgresql://usuario:senha@host:5432/spiv2?sslmode=require
JWT_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
AWS_REGION=sa-east-1
AWS_S3_BUCKET=seu-bucket-de-imagens
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
CORS_ORIGINS=https://seu-dominio.com.br
NODE_ENV=production
PORT=3333
ADMIN_EMAIL=admin@spi.com
ADMIN_PHONE=11999999999
ADMIN_NAME=Admin
```

## Variáveis de Ambiente (Frontend — Amplify)

```env
VITE_API_URL=https://api.seu-dominio.com.br
```

---

## Deploy

### Frontend — AWS Amplify

Conectado ao repositório GitHub (`taysouzaa/SPI`). Deploy automático a cada push na branch `main`. Configuração em [`amplify.yml`](amplify.yml).

### Backend — AWS EC2

```bash
# Na máquina EC2 (Ubuntu 22.04, t3.micro, us-east-1)
cd ~/spi-backend
npm run build          # compila TypeScript → dist/
pm2 restart spi-backend
```

Nginx faz proxy reverso de `https://api.seu-dominio.com.br` → `localhost:3333`.  
SSL gerenciado pelo Certbot (renovação automática).

---

## Changelog

### v2.0.0 — Junho 2026
- Autenticação sem senha (e-mail + telefone)
- Upload e armazenamento de imagens no AWS S3
- Deploy backend no AWS EC2 + Nginx + PM2
- Deploy frontend no AWS Amplify
- Painel administrativo completo
- Captura de leads via n8n → Google Sheets
- SEO completo (Open Graph, Twitter Card, sitemap)
- Clean code: remoção de comentários WHAT, constantes nomeadas, helpers extraídos

### v1.0.0
- Processamento local de imagens (Canvas API)
- Suporte a 6 marketplaces
- Histórico de imagens processadas

---

## Autora

**Taynara Souza**  
[souza.codes@gmail.com](mailto:souza.codes@gmail.com)

---

## Licença

Licença proprietária — todos os direitos reservados. Qualquer uso, mesmo parcial, requer autorização prévia e por escrito da autora. Veja [LICENSE](LICENSE) para os termos completos.

---

[spi.metodop4.com.br](https://spi.metodop4.com.br)
