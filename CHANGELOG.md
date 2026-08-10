# Changelog

Todas as mudanças relevantes deste projeto são documentadas neste arquivo.

## [1.2.0] - 2026-04-28

### Corrigido
- Formato de saída das imagens alterado de JPEG para **PNG real** (`canvas.toBlob` → `'image/png'`).
- Extensão do arquivo de saída agora é sempre `.png`, independente do formato original enviado (antes um upload `.webp` gerava saída com nome `.webp` mesmo sendo JPEG por dentro).
- Tipo MIME padrão do `googleDriveService` corrigido de `image/jpeg` para `image/png`.

### Adicionado
- Validação de tamanho máximo de arquivo (15 MB) no frontend antes do arquivo entrar na fila — antes o usuário só descobria o limite após o upload falhar no backend.
- Limite de 10 arquivos por requisição validado também no backend (`ImageController`), impedindo abuso via requisição manual.
- Timeout de 30 segundos no processamento de imagens pelo canvas do navegador — evita que a fila trave indefinidamente caso o canvas não responda.
- Botão "Baixar todas" bloqueado (`disabled`) durante a geração do ZIP, com texto "Gerando ZIP..." — impede cliques duplicados que gerariam dois ZIPs simultâneos em memória.
- Comentários explicativos adicionados em todos os arquivos do projeto (frontend e backend).

### Melhorado
- Aviso de dimensão personalizada fora do padrão passou de texto simples para card destacado com borda amarela e ícone `AlertCircle`.
- Dimensões personalizadas agora são limitadas a no máximo 4096 px nos inputs (`min=1 max=4096`) para evitar travamento do navegador em resoluções absurdas.
- Vazamento de Object URL corrigido no bloco de erro do gerador de ZIP — URL é revogada imediatamente em caso de falha, em vez de aguardar 60 segundos.
- Expiração de sessão (401) no painel de histórico agora exibe toast "Sessão expirada. Redirecionando para login..." por 2 segundos antes de recarregar a página.
- Null check defensivo nos campos `data.id` e `data.webViewLink` retornados pelo endpoint de reupload.
- Mensagens de erro do backend quando a pasta do Drive não está configurada passaram de 500 genérico para 400 com texto legível: "Pasta do Google Drive não configurada. Configure nas preferências."

---

## [1.1.1] - 2026-04-02

### Added

- Documentacao padronizada em docs/ENGENHARIA_REVISAO_2026-04-02.md.
- Diagramas Mermaid em docs/DIAGRAMAS_MERMAID_2026-04-02.md.
- Licenca padrao consolidada em LICENSE.

### Changed

- Atualizacao de governanca tecnica sem alterar logica funcional.
- Inclusao de secao de padronizacao no README.md.

### Security

- Revisao de risco para credenciais, webhooks e controle de acesso com foco nao destrutivo.

---

## [1.1.0] - 2026-03-31

### Adicionado
- `Backend/src/config/jwt.ts` para centralizar a resolução de segredos JWT.
- Documento técnico de revisão (`docs/REVISAO_TECNICA.md`) com arquitetura, riscos e inventário de limpeza.

### Alterado
- `README.md` reescrito com arquitetura atual, setup e variáveis de ambiente.
- `docs/DOCUMENTACAO.md` reescrito com seções técnicas e diagramas Mermaid.
- `LICENSE` atualizado para o formato solicitado.
- Health check do backend alterado de query unsafe para query raw parametrizada no Prisma.
- CORS do backend agora suporta configuração via `CORS_ORIGINS`.
- Módulo de processamento agora valida payloads com `zod` e tipos mais fortes.
- Fila de processamento do frontend agora revoga URLs `blob:` para prevenir vazamento de memória.

### Segurança
- Removidos usuários de seed hardcoded com dados pessoais no código-fonte.
- Seeds agora vêm da variável de ambiente `SEED_USERS_JSON`.
- Comportamento de fallback JWT centralizado com regra mais segura em produção.

### Corrigido
- `GET /users/me` agora retorna `404` quando o usuário não existe.
- Remoção de imports de ícones não usados na tela de login.

---

## [1.0.0] - 2026-01-19

### Adicionado
- Primeira versão do frontend e backend do SPI.
- Autenticação JWT, fluxo de upload e processamento de imagens.
- Módulo de histórico e integração com Google Drive.
