# DIAGRAMS

> Os diagramas refletem o código desta branch. Ao mudar rota, storage ou fluxo de
> autenticação, atualize aqui junto com o código — diagrama desatualizado engana
> mais do que ausência de diagrama.

## 1) Ciclo de vida principal do dado (usuario -> API -> banco -> S3)

```mermaid
sequenceDiagram
    autonumber
    participant U as Usuário
    participant FE as Frontend (React/Vite)
    participant API as Backend (Express)
    participant DB as PostgreSQL (Prisma)
    participant S3 as Amazon S3

    U->>FE: Login (e-mail + telefone)
    FE->>API: POST /auth/login
    API->>DB: Valida e-mail e telefone do usuário
    API-->>FE: accessToken (15min) + refreshToken (30d)

    U->>FE: Seleciona imagens e marketplace
    FE->>FE: Redimensiona via Canvas API (imagem original nunca sai daqui)
    FE->>API: POST /images/upload (multipart + JWT, até 10 arquivos)
    API->>API: ConcurrencyLimiter + withTimeout (45s)
    API->>S3: PutObject da imagem já processada
    S3-->>API: Confirmação do objeto
    API->>DB: Persiste ProcessedImage (userId, key, url)
    API-->>FE: payload com URLs e IDs

    FE->>API: GET /history
    API->>DB: Busca histórico por userId
    API-->>FE: Lista de imagens processadas
```

## 2) Download de imagem do histórico via URL pré-assinada

```mermaid
flowchart LR
    FE[Frontend] -->|GET /history/:id/download-url| API[Backend]
    API --> AUTH{JWT válido e<br/>imagem é do usuário?}
    AUTH -->|Não| ERR[HTTP 401 / 403]
    AUTH -->|Sim| S3S[S3Service.getSignedUrl]
    S3S --> S3[(Amazon S3<br/>bucket privado)]
    S3 --> S3S
    S3S -->|URL com TTL de 7 dias| API
    API --> FE
    FE -->|GET direto na URL assinada| S3
```

O bucket permanece privado. O backend nunca faz proxy do binário: ele assina uma
URL temporária e o navegador busca o objeto direto no S3, o que tira a
transferência do caminho da instância EC2.

## 3) Modo degradado de histórico

```mermaid
flowchart TD
    A[GET /history] --> B{Banco disponível?}
    B -->|Sim| C[Consulta Prisma em ProcessedImage]
    B -->|Não| D[Fallback em data/history.json]
    C --> E[Retorno consolidado]
    D --> E
```

O fallback em arquivo mantém o histórico legível quando o Postgres está fora.
Não é thread-safe entre processos e os dados se perdem em ambiente efêmero —
é rede de segurança e ambiente de demo, não substituto do banco.
