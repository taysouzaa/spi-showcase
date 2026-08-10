# TECHNICAL GUIDE

## Arquitetura
O SPI é um monorepo com duas aplicações independentes, porém integradas por API HTTP.

```text
SPI/
├── Backend/
│   ├── api/                 # Entry point serverless (Vercel)
│   ├── prisma/              # Modelagem e client ORM
│   ├── src/
│   │   ├── config/          # Variáveis de ambiente, JWT, paths e seeds
│   │   ├── database/        # Prisma client singleton
│   │   ├── middlewares/     # Auth, async wrapper e tratamento de erro
│   │   ├── modules/         # auth, users, process, history, images
│   │   ├── routes/          # Agregador principal de rotas
│   │   ├── shared/          # Erros, fallback em arquivo e utilitários
│   │   └── types/           # Extensão de tipos do Express
│   └── vercel.json
├── Frontend/
│   ├── public/              # Arquivos estáticos e config runtime
│   └── src/
│       ├── app/             # Orquestração de telas e estado global
│       ├── features/        # Fluxos por domínio (auth, processing, history)
│       ├── shared/          # Componentes, serviços, estilos, tipos e utilitários
│       └── assets/          # Logos dos marketplaces
├── docs/
└── scripts/
```

### Padrões de Código em Uso
| Padrão | Aplicação prática |
|---|---|
| Modularização por domínio | Backend dividido por módulos (`auth`, `images`, `history`, etc.) |
| Controller/Service/Repository | Separação de camadas principalmente em autenticação e usuários |
| Feature-based no frontend | Organização por fluxo de negócio em `src/features` |
| Clean Code | Funções pequenas, utilitários isolados e nomes semânticos |
| Resiliência degradada | Fallback para JSON local quando o banco está indisponível |

## Integrações
### API interna (Frontend -> Backend)
- `POST /auth/login` e `POST /auth/refresh` para sessão.
- `POST /images/upload` para envio de imagens processadas.
- `GET /history` para histórico do usuário autenticado.
- `POST /images/reupload/:id` para reenviar item ao Drive.

### Google Drive API
- Upload de imagem processada com service account.
- Retorno de `gdriveId` e links de visualização.
- Proxy assinado (`/images/drive/:id?sig=`) para proteção de acesso.

### Configuração runtime do frontend
- `Frontend/public/config.js` permite alterar `API_URL` sem rebuild.

## Scripts Disponíveis
### Raiz
| Comando | Descrição |
|---|---|
| `./scripts/start-dev.ps1` | Abre frontend e backend em paralelo no Windows |
| `./scripts/build-hostgator.ps1` | Gera build estático e compacta ZIP para publicação |

### Backend
| Comando | Descrição |
|---|---|
| `npm run dev` | Sobe API com `tsx watch` |
| `npm run build` | Gera Prisma Client e compila TypeScript |
| `npm run start` | Executa backend compilado |
| `npm run prisma:migrate` | Executa migrações Prisma |
| `npm run vercel-build` | Build para ambiente Vercel |

### Frontend
| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia Vite em desenvolvimento |
| `npm run build` | Build de produção do frontend |

## Decisões de Estrutura
- O projeto permanece com `Backend/` e `Frontend/` na raiz para minimizar impacto operacional.
- Não foi criada camada extra (`apps/`, `packages/`) para evitar overengineering.
- A separação atual já atende manutenção com baixo acoplamento e curva de onboarding curta.
