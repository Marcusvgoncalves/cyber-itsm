# 📄 Documentação Oficial / Official Documentation — CyberITSM SPN

> Este documento descreve as especificações técnicas completas da **CyberITSM SPN**: arquitetura multicamadas, autenticação/MFA, IA com RAG, governança de identidade (IAM/IGA), modelo de dados do Supabase, políticas RLS e roteiro de deploy na Vercel.
>
> This document describes the complete technical specifications of **CyberITSM SPN**: multi-layer architecture, authentication/MFA, RAG-based AI, identity governance (IAM/IGA), the Supabase data model, RLS policies, and the Vercel deployment roadmap.

---

## 🇧🇷 Português

### 1. Visão Geral

**CyberITSM SPN** é uma plataforma corporativa de **IT Service Management (ITSM)** voltada a **Arquitetura e Conformidade de Cibersegurança**. Combina:

- **Quadro Kanban interativo** para rastrear chamados de mitigação de vulnerabilidades, correlacionando cada ticket a frameworks regulatórios (NIST CSF, CIS Controls, ISO/IEC 27001, SABSA, LGPD, PCI-DSS).
- **Agente de IA generativa com RAG**, que responde estritamente sobre o contexto do chamado e sobre a base de requisitos de Arquitetura Segura **SD v4.1** (314 requisitos).
- **Portal IAM/IGA**, com integrações de identidade (Microsoft Entra ID, Keycloak, Oracle Access Manager, Sailpoint), criação manual de usuários e gestão de acessos.
- **Segurança forte**: senhas de alta complexidade, sessão por cookies, **MFA/TOTP obrigatório** para todas as contas e trilha de auditoria.

**Stack**: Next.js 16 (App Router, React 19, Tailwind CSS v4) + Supabase (PostgreSQL, Auth) + Vercel (deploy). Design system **Mistica da Vivo/Telefônica**.

---

### 2. Arquitetura da Solução

![Desenho de arquitetura da solução](../public/images/architecture.svg)

O desenho detalha os **atores, contêineres (frontend/backend), pipeline RAG de IA, motor de Security QA, banco de dados (9 tabelas + RLS), storage e integrações externas de IAM/IGA**, além da jornada de autenticação e MFA.

```mermaid
graph TD
  User["Analista SecOps / Admin / Solicitante"] -->|HTTPS| FE["Frontend Next.js 16 (React 19, Mistica)"]

  subgraph FE [Camada de Apresentação / SPA]
    UI["Páginas: /dashboard · /login · /reset-password · /security-qa · /security-qa/assess · /security-qa/project/[id]"]
    COMP["Componentes: Kanban · SecurityAgent · login-form · ArchitectureDiagram · EvidenceUpload · ProjectDashboard"]
  end

  FE -->|Server Actions (RPC)| BE["Backend Next.js Serverless (Vercel)"]
  FE -->|POST /api/qa-engine (NDJSON Stream)| API_QA["api/qa-engine — Motor Security QA"]

  subgraph BE [Camada de Servidor]
    PX["proxy.ts — sessão + RBAC + check MFA"]
    SA["Server Actions: auth.ts · iam.ts · tickets.ts"]
    AI["app/api/chat — IA RAG (Gemini + requisitos-sd.json)"]
  end

  FE -->|POST /api/chat| AI
  API_QA -->|Gemini streamObject| GEMINI["Google Gemini API (gemini-1.5-flash)"]
  API_QA -->|Salvar resultado| DB
  API_QA -->|Upload .gz / Delete bruto| ST[("Supabase Storage Buckets")]

  BE -->|SQL + RLS| DB[("Supabase PostgreSQL (ITSM) + Prisma (QA)")]

  subgraph DB [Camada de Dados]
    P1["users_profiles · tickets · ticket_statuses · comments"]
    P2["audit_logs · iam_providers · iam_users · identity_requests"]
    P3["qa_projects (nova) · qa_results (migrada para Prisma)"]
  end

  subgraph ST [Camada de Armazenamento]
    B1["qa-temp-evidences (ingestão temporária)"]
    B2["qa-logs-archive (arquivamento imutável .gz)"]
  end

  BE -->|Simulado| IAM["IAM/IGA: Entra ID · Keycloak · OAM · Sailpoint"]
```

#### 2.1 Camada de Apresentação (SPA)

- **Next.js 16 App Router + React 19**: SSG/SSR híbrido; `app/page.tsx` redireciona para `/dashboard` (se autenticado) ou `/login`.
- **Grupo de Rotas Autenticadas (`(app)`)**: As rotas logadas estão agrupadas sob `app/(app)/`, compartilhando um layout comum que renderiza o **`AppShell`** (sidebar colapsável, topbar de status e menu mobile), otimizando a consistência visual.
- **Tema Mistica**: tipografia **Outfit** (via `next/font/google`), cores roxa `#660099` e laranja Vivo `#FF9900`.
- **Componentes**:
  - `components/shell/` — `AppShell`, `Sidebar`, `Topbar`, `MobileMenu` (moldura de navegação global).
  - `components/kanban/` — `KanbanBoard`, `KanbanCard`, `KanbanColumn`, `ticket-modal`, `kanban-dashboard` (Quadro Kanban com drag-and-drop, comentários, e visualização integrada de volumetrias, previsões e calculadora de criticidade de vulnerabilidades).
  - `components/SecurityAgent.tsx` — FAB de chat de IA via `useChat` do `@ai-sdk/react` com `DefaultChatTransport`, enviando `ticketContext`.
  - `components/login-form.tsx` — fluxo de login em 3 passos (credenciais → onboarding MFA → verificação MFA).
  - `components/architecture-diagram.tsx` — mapa de arquitetura interativo (admin).
  - `components/ui/` — primitivas acessíveis (button, card, input, label, select, separator, textarea).

#### 2.2 Camada de Servidor (Vercel Serverless / Edge)

- **`proxy.ts`** (substitui `middleware.ts` no Next.js 16): valida sessão via cookies; redireciona não autenticados para `/login`; exige o cookie `mfa_verified` em `/dashboard`; bloqueia rotas administrativas (`/audit`, `/architecture`) para não-admins.
- **Server Actions** (`"use server"`), tipadas:
  - `app/actions/auth.ts` — `initiateMfa`, `confirmMfaSetup`, `verifyMfa`, `disableMfa`, `requestPasswordReset`, `resetPasswordWithToken`, `changeUserPassword`, `logoutUser`, `createAuditLog`, `getCurrentUserProfile`.
  - `app/actions/iam.ts` — `getIamProviders`, `getIamUsers`, `getIdentityRequests`, `createIdentityRequest`, `approveIdentityRequest`, `rejectIdentityRequest`, `syncIamProvider`, `createLocalUser`, `listSystemUsers`, `updateUserRole`, `setUserActive`, `forceMfaReconfiguration`.
  - `app/actions/tickets.ts` — `getTickets`, `getTicketById`, `createTicket`, `updateTicket`, `moveTicket`, `deleteTicket`, `getStatuses`, `getUsers`, `getCurrentUser`, `getAuditLogs`.
- **Clientes Supabase**:
  - `utils/supabase/server.ts` — client SSR (cookie de sessão, usado nas Server Components/Actions).
  - `utils/supabase/client.ts` — client browser (login).
  - `utils/supabase/admin.ts` — client com **service role** (bypass de RLS) para operações de admin (`admin.auth.createUser`, `updateUserById`). **Nunca usado no client.**
- **Utilitários**: `lib/totp.ts` (TOTP RFC 6238, HMAC-SHA1, Web Crypto), `lib/types.ts` (modelos + permissões RBAC), `lib/supabase.ts` (acesso a dados), `lib/utils.ts` (`cn()`).

---

### 3. Autenticação, MFA & Jornada de Identidade

Fluxo implementado em `components/login-form.tsx` e nas Server Actions de `auth.ts`:

1. **Credenciais** — `signInWithPassword` (Supabase Auth). O identificador do usuário segue o padrão `nome.sobrenome` (sem exigir formato de e-mail na entrada da interface). Internamente, o sistema mapeia para `@cyberitsm.local` para compatibilidade com o provedor Supabase. As senhas seguem política forte (≥12 caracteres, contendo maiúsculas, minúsculas, números e símbolos).
2. **Verificação de perfil** — consulta `users_profiles.mfa_setup_complete`.
3. **Sem MFA (primeiro acesso)** → onboarding: `initiateMfa` gera um secret Base32 e o URI `otpauth://`; a UI exibe um QR Code (simulado) e a chave secreta; o usuário informa o código de 6 dígitos (Google Authenticator) e `confirmMfaSetup` valida e grava o cookie `mfa_verified`.
4. **Com MFA** → `verifyMfa` valida o código na janela temporária **±1 intervalo (30 s)** e grava o cookie `mfa_verified` (24 h, `httpOnly`, `SameSite=Strict`).
5. **Proteção de rota** — `proxy.ts` impede acesso ao `/dashboard` sem o cookie → **MFA obrigatório para todas as contas**.
6. **Ciclo de Vida da Sessão e Expiração por Inatividade**: A sessão tem tempo limite absoluto de 1 hora de utilização contínua e tempo limite de inatividade (idle timeout) de 15 minutos. Um listener no frontend intercepta interações (movimento do mouse, cliques, teclas, rolagem) a cada 10 segundos e atualiza o cookie `last_activity`. Se qualquer um dos limites for estourado, o `proxy.ts` ou o verificado de timer do cliente invalida o cookie de MFA e redireciona para `/login?session_expired=true`.
6. **Recuperação de senha** — `requestPasswordReset` gera `reset_token` (válido 1 h) e exibe o link `/reset-password?token=XYZ` no sandbox; `resetPasswordWithToken` troca a senha e limpa o token.

**Validação TOTP** (`lib/totp.ts`): `verifyTOTP(token, secret)` — valida 6 dígitos, janela de −1/0/+1, HMAC-SHA1 via Web Crypto, com fallback de homologação `123456`.

**Auditoria** — `createAuditLog` registra eventos como `mfa_setup_confirm`, `mfa_verify_success`, `mfa_disabled`, `password_change`, `local_user_create`, `user_role_update`, `identity_request_approve`, etc.

---

### 4. Agente de IA SecOps (Pipeline RAG)

- **Endpoint**: `app/api/chat/route.ts`.
- **Modelo**: Google **Gemini** via `@ai-sdk/google` — `createGoogleGenerativeAI({ apiKey })`, modelo `gemini-1.5-flash` (downgrade estratégico para otimização de RPM/RPD). Possui tratamento e intercepção robusta de erros de cota / Rate Limit (HTTP 429 - RESOURCE_EXHAUSTED).
- **Histórico**: Armazenamento no browser via `localStorage` com partição dinâmica por ID do usuário logado (`cyberitsm_secops_chat_messages_${userId}`), persistido no logoff/timeout.
- **Conhecimento**: `requisitos-sd.json` — **314 requisitos** de Arquitetura Segura. Cada requisito possui: `id` (ex.: `VIVO.SEGURA.APIS.001`), `controle`, `detalhamento`, `componente`, `propriedade`, `strideLM`, `riscos`, `owasp`, `categoria`, `criticidade`, `tipoControle`, `evidencia`, `comoTestar`.
- **Recuperação** (`retrieveRelevantRequisitos`, limite padrão 6):
  - Tokenização com normalização **NFD** (remove acentos), lowercase, split por não-alfanumérico, remoção de tokens ≤2 e de uma lista de stopwords em português.
  - Score ponderado por campo: `core` (id/controle/componente/owasp/strideLM) ×3, `detail` (detalhamento/riscos/categoria/propriedade) ×2, `light` (criticidade) ×1.
  - Retorna apenas scores > 0, ordenados decrescente.
- **Construção da mensagem**: injeta `[CONTEXTO DO CHAMADO]` + `[BASE DE CONHECIMENTO - REQUISITOS RELEVANTES]` no prompt final; aplica `sanitizeText` (anti prompt-injection, remove caracteres de controle).
- **Diretrizes (system prompt)**: máxima assertividade; sem cumprimentos; respostas em bullets curtos; completas/exaustivas sem truncar; citar ID, componente, categoria, criticidade e evidência/como testar; se não houver informação → `'Informação não encontrada no contexto atual.'`.
- **Parâmetros**: `temperature: 0.2`, `maxOutputTokens: 4096`, `toUIMessageStreamResponse()`.
- **UI**: `components/SecurityAgent.tsx` (FAB) — `useChat` do `@ai-sdk/react`, `DefaultChatTransport` com `body: { ticketContext }`, renderiza mensagens por `parts`.

---

#### 4.1 Base de Conhecimento e Frameworks (Apresentação Didática)
- **Tabela de Requisitos**: Integrada diretamente no frontend na nova aba "Base de Conhecimento", mapeia os 314 controles técnicos com filtros inteligentes em tempo real (busca textual rápida por ID, componente, riscos ou categorias). Cada linha da tabela é expansível e revela o detalhamento do controle, riscos associados, instruções de teste/validação e a evidência esperada.
- **Enciclopédia de Frameworks**: Espaço conceitual didático para capacitar equipes sobre as bases metodológicas de governança e modelagem de ameaças:
  - **NIST CSF**: 5 funções contínuas (Identificar, Proteger, Detectar, Responder, Recuperar).
  - **CIS Controls**: Higiene cibernética priorizada (18 controles e grupos de implementação).
  - **OWASP Top 10**: Padrão de segurança contra as 10 principais fraquezas de aplicações web.
  - **STRIDE Threat Modeling**: Classificação sistemática de ameaças (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege).
  - **ISO 27001 & SABSA**: Governança baseada em SGSI e arquitetura de segurança integrada aos objetivos de negócio.
  - **LGPD**: Regras e salvaguardas necessárias para tratamento e privacidade de dados pessoais.

---

#### 4.2 Serviço de E-mail Transacional (Resend)
- **Engine de E-mail**: Implementado sob a biblioteca oficial `@react-email/render` e o SDK da **Resend** em [resendClient.ts](file:///c:/Projetos/cyber-itsm/lib/email/resendClient.ts) e [notifications.tsx](file:///c:/Projetos/cyber-itsm/lib/email/notifications.tsx).
- **Disparo de Eventos**: Disparado de forma assíncrona (fire-and-forget) após a criação ou atualização de chamados, assegurando que gargalos ou indisponibilidade de e-mail não impactem o tempo de resposta das APIs do sistema.
- **Modos de Operação**:
  - **Sandbox**: Modo padrão de homologação. O remetente é fixado em `onboarding@resend.dev` e o envio de destino é forçado para o e-mail de teste verificado (`TEST_EMAIL_RECIPIENT`), prevenindo spam para destinatários não cadastrados no painel da Resend.
  - **Production**: Ativado ao setar `EMAIL_MODE=production`. Dispara para todos os e-mails associados ao chamado utilizando o remetente oficial do domínio verificado (`EMAIL_FROM`).
- **Resiliência**: Caso a chave `RESEND_API_KEY` esteja ausente ou configurada com marcas placeholder, o sistema loga o incidente e degrada silenciosamente, mantendo a estabilidade operacional da plataforma.

---

### 5. Governança de Identidade (IAM / IGA)

- **Provedores simulados** (`iam_providers`): Microsoft Entra ID (OIDC), Keycloak Broker, Oracle Access Manager (header `OAM_REMOTE_USER`), Sailpoint IdentityNow (IGA) e `local`.
- **Sincronização** (`syncIamProvider`): insere usuários mock em `iam_users` (Entra: maria.cyber, carlos.grc; Keycloak: jose.admin), com `UNIQUE(provider_id, external_id)`.
- **Fila Sailpoint** (`identity_requests`): criação (`createIdentityRequest`) com status `pendente`; aprovação (`approveIdentityRequest`) atualiza o papel do perfil-alvo em `users_profiles` e o status para `provisionado`; rejeição (`rejectIdentityRequest`) seta `rejeitado`.
- **Criação manual de usuário** (`createLocalUser`):
  - Verifica **admin**.
  - Cria usuário **real** em `auth.users` via **Admin API** (`admin.auth.admin.createUser`) com a senha padrão inicial configurada como **`CyberITSM@2026!Password`**, `email_confirm: true`, `user_metadata.role`/`full_name` e `requires_password_change`.
  - O trigger `on_auth_user_created` cria o perfil em `users_profiles`; um `upsert` garante `mfa_setup_complete = false` (MFA obrigatório).
  - Registra em `audit_logs` e retorna a **senha padrão** configurada (`CyberITSM@2026!Password`) para o admin repassar ao usuário (que trocará a senha e configurará o MFA no primeiro login).
- **Gestão de usuários (admin)**:
  - `listSystemUsers` — lista perfis.
  - `updateUserRole(userId, role)` — muda papel RBAC (e sincroniza `app_metadata` via `admin.auth.admin.updateUserById`); protege contra auto-rebaixamento.
  - `setUserActive(userId, active)` — ban (`ban_duration`) ou reativa; protege contra auto-desativação.
  - `forceMfaReconfiguration(userId)` — limpa `mfa_secret`/`mfa_setup_complete`, obrigando nova configuração no próximo login.
- **UI**: aba "Portal IAM/IGA" do dashboard — provedores, "Cadastrar Usuário Local" (exibe a indicação da senha padrão), "Gestão de Usuários do Sistema" (papel, status MFA, reset MFA, desativar) e a fila de aprovação Sailpoint.

---

### 6. Modelo de Dados (Supabase)

Banco PostgreSQL 15 com **8 tabelas**, todas com **Row Level Security (RLS)** ativa.

| Tabela | Descrição | Colunas principais |
| :--- | :--- | :--- |
| `users_profiles` | Perfis de usuário (sincronizados com `auth.users`) | `id` (PK → `auth.users`), `email` (unique), `full_name`, `role` (admin/analista/solicitante), `avatar_url`, `mfa_secret`, `mfa_setup_complete` (default false), `reset_token`, `reset_token_expires_at`, `created_at`, `updated_at` |
| `tickets` | Chamados de mitigação | `title`, `description`, `status` (→ `ticket_statuses`), `priority` (baixa/media/alta/critica), `framework_origem` (NIST/CIS/ISO/SABSA/LGPD/PCI-DSS), `dominio_framework`, `assignee_id`/`reporter_id` (FK `users_profiles`), `tags` (text[]), `compliance_frameworks` (text[]), `closed_at` |
| `ticket_statuses` | Estados do Kanban | `id` (PK), `name`, `color`, `position`, `is_default` — seeds: aberto, em_andamento, em_revisao, fechado, cancelado |
| `comments` | Comentários dos chamados | `ticket_id` (FK CASCADE), `author_id` (FK CASCADE), `content`, `created_at` |
| `audit_logs` | Trilha de auditoria | `user_id` (FK SET NULL), `action`, `entity_type`, `entity_id`, `old_data`/`new_data` (jsonb), `ip_address`, `user_agent`, `created_at` |
| `iam_providers` | Provedores de identidade | `id` (PK), `name`, `type` (entra_id/keycloak/oam/sailpoint/local), `config` (jsonb), `is_active` |
| `iam_users` | Usuários sincronizados de IAM | `provider_id` (FK CASCADE), `external_id`, `email`, `full_name`, `department`, `role`, `is_active`, `last_sync` — `UNIQUE(provider_id, external_id)` |
| `identity_requests` | Requisições de acesso (IGA) | `requester_id`, `provider_id`, `target_user_email`, `requested_role`, `justification`, `status` (pendente/aprovado/rejeitado/provisionado), `approver_id`, `approved_at` |

**Funções**: `handle_new_user()` (cria perfil no signup), `handle_updated_at()` (atualiza `updated_at`), `handle_ticket_closed()` (define/limpa `closed_at`), `is_admin()`, `is_analista()`, `is_admin_or_analista()`.

**Triggers**: `on_auth_user_created` (AFTER INSERT em `auth.users`), `trigger_*_updated_at` (BEFORE UPDATE em cada tabela), `trigger_ticket_closed` (BEFORE UPDATE em `tickets`).

**RLS destacadas**:
- `users_profiles`: view própria; admins veem/atualizam todos; insert só admin; todos autenticados podem ver perfis.
- `tickets`: view (reporter OU assignee OU admin/analista); create (reporter); update (reporter/assignee/admin/analista); delete (admin).
- `audit_logs`: SELECT só admin; INSERT quando `auth.uid() = user_id`.
- `iam_providers`/`iam_users`: view todos; gestão por admin/analista.
- `identity_requests`: create (requester); update/aprovação (admin/analista).

**Extensões**: `uuid-ossp` (uuid_generate_v4), `pgcrypto`. Schema completo: `supabase-schema.sql`.

### 7. Centro de Security QA (Análise de Relatórios & Ingestão)

Este módulo implementa um Bounded Context isolado para receber relatórios brutos de vulnerabilidades (formatos `.json`, `.xml` ou `.txt` de até 5 MB) e analisá-los contra um escopo específico de requisitos de segurança.

#### 7.1 Pipeline de Processamento (Ingestão & IA)
O fluxo ocorre de forma transacional e em tempo real via a API Route `POST /api/qa-engine`:
1. **Upload Direto para o Temp Bucket**: O cliente faz upload do arquivo original para o bucket `qa-temp-evidences` no Supabase Storage utilizando o client público.
2. **Download do Dado Bruto**: O servidor baixa o arquivo do bucket de forma segura utilizando o cliente de `service_role`.
3. **Análise Estruturada via IA**: Os dados brutos e os requisitos técnicos são cruzados pelo motor de IA. O modelo `gemini-flash-latest` é executado com a diretriz `streamObject` (do Vercel AI SDK), gerando uma resposta estruturada que valida a conformidade de cada requisito em tempo real (NDJSON stream), reportando evidências e recomendações técnicas.
4. **Arquivamento e Compressão Forense**: O texto original do relatório é comprimido no formato GZIP (`zlib` nativo do Node com nível de compressão máxima = 9) e armazenado no bucket imutável `qa-logs-archive`. O caminho do arquivo `.gz` e os metadados de compressão (tamanho original vs comprimido) são gravados.
5. **Persistência de Resultados**: Os resultados da análise, o sumário executivo, a porcentagem de conformidade (`compliance_percent`), a classificação de risco (`overall_rating`) e a URL assinada de acesso ao arquivo `.gz` são persistidos na tabela `qa_results` do banco de dados.
6. **Expurgo Completo (Data Purge)**: Após a confirmação de escrita em banco e upload no bucket imutável, o arquivo temporário original é removido do bucket `qa-temp-evidences`, garantindo a retenção apenas da evidência comprimida.

#### 7.2 Exportação de PDF e Gráficos
- **PDF nativo**: Gerado no lado do cliente utilizando a biblioteca `@react-pdf/renderer` através do componente `<QaReportDocument />`, que reconstrói a estrutura visual do sumário executivo, da tabela de requisitos e dos metadados forenses.
- **Gráficos Recharts**: O dashboard renderiza a taxa de conformidade em um gráfico radial de ângulo polar e exibe a contagem de conformidade por status em um gráfico de barras.

---

### 8. Execução, Build & Deploy

#### 8.1 Ambiente (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
```
- A **service role** é obrigatória para criação manual de usuários e gestão IAM; roda apenas no servidor.
- A **Gemini key** é necessária para a IA generativa.

#### 8.2 Comandos
```bash
npm run dev       # desenvolvimento
npm run build     # build de produção (validação de tipos + rotas)
npm start         # executa o build
npm run lint      # ESLint
npx tsc --noEmit  # checagem de tipos estrita
```

#### 8.3 Vercel (produção online)
1. Aplicar `supabase-schema.sql` no SQL Editor do Supabase.
2. Conectar o repositório na Vercel (deploy por push na `main`) ou `vercel --prod`.
3. Definir as 4 variáveis de ambiente em **Settings → Environment Variables**.
4. Segurança: não expor `SUPABASE_SERVICE_ROLE_KEY` no client; `proxy.ts` garante MFA antes do dashboard.

---

## 🇺🇸 English

### 1. Overview

**CyberITSM SPN** is a corporate **IT Service Management (ITSM)** platform focused on **Cybersecurity Architecture and Regulatory Compliance**. It combines:

- An **interactive Kanban board** to track vulnerability remediation tickets, correlating each with regulatory frameworks (NIST CSF, CIS Controls, ISO/IEC 27001, SABSA, LGPD, PCI-DSS).
- A **generative AI agent with RAG**, answering strictly about ticket context and the **SD v4.1** Secure Architecture requirements base (314 requirements).
- An **IAM/IGA portal**, with identity integrations (Microsoft Entra ID, Keycloak, Oracle Access Manager, Sailpoint), manual user creation, and access management.
- **Strong security**: high-complexity passwords, cookie sessions, **mandatory MFA/TOTP** for all accounts, and a full audit trail.

**Stack**: Next.js 16 (App Router, React 19, Tailwind CSS v4) + Supabase (PostgreSQL, Auth) + Vercel (deployment). Vivo/Telefónica **Mistica** design system.

---

### 2. Solution Architecture

![Solution architecture diagram](../public/images/architecture.svg)

The diagram details the **actors, containers (frontend/backend), AI RAG pipeline, Security QA engine, database (9 tables + RLS), storage and external IAM/IGA integrations**, plus the authentication and MFA journey.

```mermaid
graph TD
  User["SecOps Analyst / Admin / Requester"] -->|HTTPS| FE["Next.js 16 Frontend (React 19, Mistica)"]

  subgraph FE [Presentation / SPA]
    UI["Pages: /dashboard · /login · /reset-password · /security-qa · /security-qa/assess · /security-qa/project/[id]"]
    COMP["Components: Kanban · SecurityAgent · login-form · ArchitectureDiagram · EvidenceUpload · ProjectDashboard"]
  end

  FE -->|Server Actions (RPC)| BE["Next.js Serverless Backend (Vercel)"]
  FE -->|POST /api/qa-engine (NDJSON Stream)| API_QA["api/qa-engine — Security QA Engine"]

  subgraph BE [Server Layer]
    PX["proxy.ts — session + RBAC + MFA check"]
    SA["Server Actions: auth.ts · iam.ts · tickets.ts"]
    AI["app/api/chat — RAG AI (Gemini + requisitos-sd.json)"]
  end

  FE -->|POST /api/chat| AI
  API_QA -->|Gemini streamObject| GEMINI["Google Gemini API (gemini-1.5-flash)"]
  API_QA -->|Save result| DB
  API_QA -->|Upload .gz / Delete raw| ST[("Supabase Storage Buckets")]

  BE -->|SQL + RLS| DB[("Supabase PostgreSQL (ITSM) + Prisma (QA)")]

  subgraph DB [Data Layer]
    P1["users_profiles · tickets · ticket_statuses · comments"]
    P2["audit_logs · iam_providers · iam_users · identity_requests"]
    P3["qa_projects (new) · qa_results (migrated to Prisma)"]
  end

  subgraph ST [Storage Layer]
    B1["qa-temp-evidences (temporary ingestion)"]
    B2["qa-logs-archive (immutable archival .gz)"]
  end

  BE -->|Simulated| IAM["IAM/IGA: Entra ID · Keycloak · OAM · Sailpoint"]
```

#### 2.1 Presentation Layer (SPA)

- **Next.js 16 App Router + React 19**: hybrid SSG/SSR; `app/page.tsx` redirects to `/dashboard` (if authenticated) or `/login`.
- **Authenticated Route Group (`(app)`)**: Authenticated routes are grouped under `app/(app)/`, sharing a layout that renders the global **`AppShell`** (collapsible sidebar, status topbar, and mobile menu), ensuring visual and navigation consistency.
- **Mistica theme**: **Outfit** typography (via `next/font/google`), Vivo purple `#660099` and orange `#FF9900`.
- **Components**:
  - `components/shell/` — `AppShell`, `Sidebar`, `Topbar`, `MobileMenu` (global layout frame).
  - `components/kanban/` — `KanbanBoard`, `KanbanCard`, `KanbanColumn`, `ticket-modal`, `kanban-dashboard` (Kanban Board with drag-and-drop, comments, and integrated view of metrics/forecasts and vulnerability criticality calculator).
  - `components/SecurityAgent.tsx` — AI chat FAB via `useChat` from `@ai-sdk/react` with `DefaultChatTransport`, sending `ticketContext`.
  - `components/login-form.tsx` — 3-step login flow (credentials → MFA onboarding → MFA verification).
  - `components/architecture-diagram.tsx` — interactive architecture map (admin).
  - `components/ui/` — accessible primitives (button, card, input, label, select, separator, textarea).

#### 2.2 Server Layer (Vercel Serverless / Edge)

- **`proxy.ts`** (replaces `middleware.ts` in Next.js 16): validates session cookies; redirects unauthenticated users to `/login`; requires the `mfa_verified` cookie on `/dashboard`; blocks admin routes (`/audit`, `/architecture`) for non-admins.
- **Typed Server Actions** (`"use server"`):
  - `app/actions/auth.ts` — `initiateMfa`, `confirmMfaSetup`, `verifyMfa`, `disableMfa`, `requestPasswordReset`, `resetPasswordWithToken`, `changeUserPassword`, `logoutUser`, `createAuditLog`, `getCurrentUserProfile`.
  - `app/actions/iam.ts` — `getIamProviders`, `getIamUsers`, `getIdentityRequests`, `createIdentityRequest`, `approveIdentityRequest`, `rejectIdentityRequest`, `syncIamProvider`, `createLocalUser`, `listSystemUsers`, `updateUserRole`, `setUserActive`, `forceMfaReconfiguration`.
  - `app/actions/tickets.ts` — `getTickets`, `getTicketById`, `createTicket`, `updateTicket`, `moveTicket`, `deleteTicket`, `getStatuses`, `getUsers`, `getCurrentUser`, `getAuditLogs`.
- **Supabase clients**:
  - `utils/supabase/server.ts` — SSR client (session cookies, used in Server Components/Actions).
  - `utils/supabase/client.ts` — browser client (login).
  - `utils/supabase/admin.ts` — **service-role** client (RLS bypass) for admin ops (`admin.auth.createUser`, `updateUserById`). **Never used on the client.**
- **Utilities**: `lib/totp.ts` (TOTP RFC 6238, HMAC-SHA1, Web Crypto), `lib/types.ts` (models + RBAC permissions), `lib/supabase.ts` (data access), `lib/utils.ts` (`cn()`).

---

### 3. Authentication, MFA & Identity Journey

Flow implemented in `components/login-form.tsx` and the Server Actions in `auth.ts`:

1. **Credentials** — `signInWithPassword` (Supabase Auth). The username follows the `nome.sobrenome` pattern (without requiring email format validation on interface inputs). Internally, the backend maps it to `@cyberitsm.local` for Supabase compatibility. Passwords follow a strong complexity policy (≥12 chars, containing uppercase, lowercase, numbers, and symbols).
2. **Profile check** — reads `users_profiles.mfa_setup_complete`.
3. **No MFA (first access)** → onboarding: `initiateMfa` generates a Base32 secret and an `otpauth://` URI; the UI renders a (simulated) QR Code and the secret key; the user enters the 6-digit code (Google Authenticator) and `confirmMfaSetup` validates and stores the `mfa_verified` cookie.
4. **MFA present** → `verifyMfa` validates the code within the **±1 interval (30 s)** time window and stores the `mfa_verified` cookie (24 h, `httpOnly`, `SameSite=Strict`).
5. **Route protection** — `proxy.ts` blocks `/dashboard` access without the cookie → **MFA mandatory for all accounts**.
6. **Session Lifetimes & Idle Inactivity Timeout**: The session enforces a 1-hour absolute duration ceiling and a 15-minute idle inactivity timeout. Client-side trackers capture user input events (clicks, scrolls, typing) and throttle update cookies to 10-second intervals. Expiry triggers automatic cookie destruction via `proxy.ts` middleware or client-side checks and redirects users to `/login?session_expired=true`.
6. **Password recovery** — `requestPasswordReset` generates a `reset_token` (valid 1 h) and displays the `/reset-password?token=XYZ` link in the sandbox; `resetPasswordWithToken` changes the password and clears the token.

**TOTP validation** (`lib/totp.ts`): `verifyTOTP(token, secret)` — validates 6 digits, window −1/0/+1, HMAC-SHA1 via Web Crypto, with the `123456` testing fallback.

**Auditing** — `createAuditLog` records events such as `mfa_setup_confirm`, `mfa_verify_success`, `mfa_disabled`, `password_change`, `local_user_create`, `user_role_update`, `identity_request_approve`, and more.

---

### 4. SecOps AI Agent (RAG Pipeline)

- **Endpoint**: `app/api/chat/route.ts`.
- **Model**: Google **Gemini** via `@ai-sdk/google` — `createGoogleGenerativeAI({ apiKey })`, model `gemini-1.5-flash` (strategic downgrade for RPM/RPD optimization). Features robust HTTP 429 (Rate Limit) exception handling.
- **History**: Local storage persistence (`localStorage`) partitioned dynamically by user ID (`cyberitsm_secops_chat_messages_${userId}`), preserved on logoff/timeout.
- **Knowledge**: `requisitos-sd.json` — **314 requirements** of Secure Architecture. Each requirement has: `id` (e.g. `VIVO.SEGURA.APIS.001`), `controle`, `detalhamento`, `componente`, `propriedade`, `strideLM`, `riscos`, `owasp`, `categoria`, `criticidade`, `tipoControle`, `evidencia`, `comoTestar`.
- **Retrieval** (`retrieveRelevantRequisitos`, default limit 6):
  - Tokenization with **NFD** normalization (strips accents), lowercase, split on non-alphanumerics, removal of tokens ≤2 and a Portuguese stopword list.
  - Weighted field scoring: `core` (id/controle/componente/owasp/strideLM) ×3, `detail` (detalhamento/riscos/categoria/propriedade) ×2, `light` (criticidade) ×1.
  - Returns only scores > 0, sorted descending.
- **Message building**: injects `[CONTEXTO DO CHAMADO]` + `[BASE DE CONHECIMENTO - REQUISITOS RELEVANTES]` into the final prompt; applies `sanitizeText` (anti prompt-injection, removes control characters).
- **Directives (system prompt)**: maximum assertiveness; no greetings; short bullet answers; complete/exhaustive without truncating; cite ID, component, category, criticality, and evidence/how-to-test; if no information → `'Informação não encontrada no contexto atual.'`.
- **Parameters**: `temperature: 0.2`, `maxOutputTokens: 4096`, `toUIMessageStreamResponse()`.
- **UI**: `components/SecurityAgent.tsx` (FAB) — `useChat` from `@ai-sdk/react`, `DefaultChatTransport` with `body: { ticketContext }`, renders messages via `parts`.

---

#### 4.1 Knowledge Base & Frameworks (Didactic Presentation)
- **Requirements Matrix**: Integrated directly in the frontend inside the new "Base de Conhecimento" tab, mapping the 314 technical controls with smart real-time filtering (fast text search by ID, component, risks, or categories). Each row in the table is expandable to reveal control details, associated risks, validation instructions, and expected evidence.
- **Frameworks Encyclopedia**: Concepts section to enable teams to learn the methodological foundations of security governance and threat modeling:
  - **NIST CSF**: 5 continuous functions (Identify, Protect, Detect, Respond, Recover).
  - **CIS Controls**: Prioritized cyber hygiene (18 controls and implementation groups).
  - **OWASP Top 10**: Standard security index against the 10 most common web application weaknesses.
  - **STRIDE Threat Modeling**: Systematic threat categorization (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege).
  - **ISO 27001 & SABSA**: Information Security Management System (ISMS) governance and business-driven security architecture.
  - **LGPD**: Data privacy compliance requirements for handling personal data (PII).

---

#### 4.2 Transactional Email Service (Resend)
- **Email Engine**: Built on the official `@react-email/render` engine and the **Resend** SDK in [resendClient.ts](file:///c:/Projetos/cyber-itsm/lib/email/resendClient.ts) and [notifications.tsx](file:///c:/Projetos/cyber-itsm/lib/email/notifications.tsx).
- **Asynchronous Triggers**: Fired in a fire-and-forget manner on ticket creation or status update events, preventing any network latency or Resend service downtime from blocking application responses.
- **Operational Modes**:
  - **Sandbox**: Default testing environment. The sender is fixed to `onboarding@resend.dev` and target delivery is forced to the verified test email address (`TEST_EMAIL_RECIPIENT`) to avoid spamming unverified users.
  - **Production**: Enabled with `EMAIL_MODE=production`. Sends notifications directly to all ticket-involved emails from the verified organization domain (`EMAIL_FROM`).
- **Resilience**: If the API key is not configured or left as a placeholder, the module logs the omission and degrades gracefully, ensuring application flows continue normally.

---

### 5. Identity Governance (IAM / IGA)

- **Simulated providers** (`iam_providers`): Microsoft Entra ID (OIDC), Keycloak Broker, Oracle Access Manager (`OAM_REMOTE_USER` header), Sailpoint IdentityNow (IGA), and `local`.
- **Sync** (`syncIamProvider`): inserts mock users into `iam_users` (Entra: maria.cyber, carlos.grc; Keycloak: jose.admin), with `UNIQUE(provider_id, external_id)`.
- **Sailpoint queue** (`identity_requests`): creation (`createIdentityRequest`) with `pendente` status; approval (`approveIdentityRequest`) updates the target profile role in `users_profiles` and the status to `provisionado`; rejection (`rejectIdentityRequest`) sets `rejeitado`.
- **Manual user creation** (`createLocalUser`):
  - Verifies **admin**.
  - Creates a **real** user in `auth.users` via the **Admin API** (`admin.auth.admin.createUser`) with the default password configured as **`CyberITSM@2026!Password`**, `email_confirm: true`, `user_metadata.role`/`full_name`, and `requires_password_change`.
  - The `on_auth_user_created` trigger creates the profile in `users_profiles`; an `upsert` guarantees `mfa_setup_complete = false` (mandatory MFA).
  - Records to `audit_logs` and returns the **default password** (`CyberITSM@2026!Password`) for the admin to distribute (the user changes it and configures MFA on first login).
- **User management (admin)**:
  - `listSystemUsers` — lists profiles.
  - `updateUserRole(userId, role)` — changes the RBAC role (also syncs `app_metadata` via `admin.auth.admin.updateUserById`); protects against self-demotion.
  - `setUserActive(userId, active)` — ban (`ban_duration`) or reactivate; protects against self-disable.
  - `forceMfaReconfiguration(userId)` — clears `mfa_secret`/`mfa_setup_complete`, forcing reconfiguration on next login.
- **UI**: "Portal IAM/IGA" dashboard tab — providers, "Cadastrar Usuário Local" (shows indication of the default password), "Gestão de Usuários do Sistema" (role, MFA status, MFA reset, deactivate), and the Sailpoint approval queue.

---

### 6. Data Model (Supabase)

PostgreSQL 15 database with **8 tables**, all with **Row Level Security (RLS)** enabled.

| Table | Description | Main columns |
| :--- | :--- | :--- |
| `users_profiles` | User profiles (synced with `auth.users`) | `id` (PK → `auth.users`), `email` (unique), `full_name`, `role` (admin/analista/solicitante), `avatar_url`, `mfa_secret`, `mfa_setup_complete` (default false), `reset_token`, `reset_token_expires_at`, `created_at`, `updated_at` |
| `tickets` | Remediation tickets | `title`, `description`, `status` (→ `ticket_statuses`), `priority` (low/medium/high/critical), `framework_origem` (NIST/CIS/ISO/SABSA/LGPD/PCI-DSS), `dominio_framework`, `assignee_id`/`reporter_id` (FK `users_profiles`), `tags` (text[]), `compliance_frameworks` (text[]), `closed_at` |
| `ticket_statuses` | Kanban states | `id` (PK), `name`, `color`, `position`, `is_default` — seeds: aberto, em_andamento, em_revisao, fechado, cancelado |
| `comments` | Ticket comments | `ticket_id` (FK CASCADE), `author_id` (FK CASCADE), `content`, `created_at` |
| `audit_logs` | Audit trail | `user_id` (FK SET NULL), `action`, `entity_type`, `entity_id`, `old_data`/`new_data` (jsonb), `ip_address`, `user_agent`, `created_at` |
| `iam_providers` | Identity providers | `id` (PK), `name`, `type` (entra_id/keycloak/oam/sailpoint/local), `config` (jsonb), `is_active` |
| `iam_users` | IAM-synced users | `provider_id` (FK CASCADE), `external_id`, `email`, `full_name`, `department`, `role`, `is_active`, `last_sync` — `UNIQUE(provider_id, external_id)` |
| `identity_requests` | Access requests (IGA) | `requester_id`, `provider_id`, `target_user_email`, `requested_role`, `justification`, `status` (pendente/aprovado/rejeitado/provisionado), `approver_id`, `approved_at` |

**Functions**: `handle_new_user()` (creates profile on signup), `handle_updated_at()` (updates `updated_at`), `handle_ticket_closed()` (sets/clears `closed_at`), `is_admin()`, `is_analista()`, `is_admin_or_analista()`.

**Triggers**: `on_auth_user_created` (AFTER INSERT on `auth.users`), `trigger_*_updated_at` (BEFORE UPDATE on every table), `trigger_ticket_closed` (BEFORE UPDATE on `tickets`).

**Key RLS**:
- `users_profiles`: view own; admins view/update all; insert only admin; all authenticated can view profiles.
- `tickets`: view (reporter OR assignee OR admin/analista); create (reporter); update (reporter/assignee/admin/analista); delete (admin).
- `audit_logs`: SELECT only admin; INSERT when `auth.uid() = user_id`.
- `iam_providers`/`iam_users`: view all; management by admin/analista.
- `identity_requests`: create (requester); update/approval (admin/analista).

**Extensions**: `uuid-ossp` (uuid_generate_v4), `pgcrypto`. Full schema: `supabase-schema.sql`.

### 7. Security QA Center (Report Analysis & Ingestion)

This module implements an isolated Bounded Context to ingest raw vulnerability reports (supported formats: `.json`, `.xml`, or `.txt` up to 5 MB) and analyze them against a specific scope of technical security requirements.

#### 7.1 Ingestion & AI Pipeline
The process runs transactionally and in real-time via the API Route `POST /api/qa-engine`:
1. **Direct Upload to Temp Bucket**: The client uploads the original file directly to the `qa-temp-evidences` bucket on Supabase Storage using the anonymous public client.
2. **Download Raw Content**: The server retrieves the raw file from the temporary bucket securely using the `service_role` client.
3. **Structured AI Analysis**: The raw report and technical requirements are analyzed. The Gemini model (`gemini-flash-latest`) is called using `streamObject` (from the Vercel AI SDK) to yield structured compliance verdicts, evidence fragments, and recommendations in real-time (NDJSON stream).
4. **Archival & GZIP Forensic Compression**: The original text is compressed using GZIP (`zlib` native with maximum compression level = 9) and uploaded to the immutable `qa-logs-archive` bucket. Compression metrics (original vs compressed size) are captured.
5. **Result Persistency**: Analysis results, including the executive summary, compliance percent, overall rating, and a signed download URL for the compressed GZIP file, are persisted in the `qa_results` database table.
6. **Data Purge**: Once database insertion and GZIP archive upload are verified, the original raw file is permanently removed from the temporary `qa-temp-evidences` bucket, enforcing data minimisation.

#### 7.2 Exporting PDFs and Rendering Charts
- **Native PDF**: Generated client-side using `@react-pdf/renderer` via the `<QaReportDocument />` component, replicating the layout, executive summary, requirement table, and forensic audit metadata.
- **Recharts Visualization**: The dashboard renders the overall compliance percentage using a polar radial gauge, and displays status distribution counts using a clean bar chart.

---

### 8. Execution, Build & Deploy

#### 8.1 Environment (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
```
- The **service role** is required for manual user creation and IAM management; it runs only server-side.
- The **Gemini key** is required for generative AI.

#### 8.2 Commands
```bash
npm run dev       # development
npm run build     # production build (type + route validation)
npm start         # run the build
npm run lint      # ESLint
npx tsc --noEmit  # strict type check
```

#### 8.3 Vercel (online production)
1. Apply `supabase-schema.sql` in the Supabase SQL Editor.
2. Connect the repository in Vercel (deploy on `main` push) or `vercel --prod`.
3. Set the 4 environment variables in **Settings → Environment Variables**.
4. Security: never expose `SUPABASE_SERVICE_ROLE_KEY` on the client; `proxy.ts` enforces MFA before the dashboard.

---

### 9. Mitigação de Vulnerabilidades / Vulnerability Remediation

#### 9.1 Remoção do Pacote `xlsx` (Agosto 2026)
- **Motivo**: O pacote `xlsx` continha falhas de segurança de alta gravidade (ReDoS e poluição de protótipo) detectadas em scans SCA.
- **Resolução**: Removido por obsolescência, uma vez que a leitura do Excel foi substituída pela base local estável em JSON (`requisitos-sd.json`). A base de dependências do repositório foi zerada de vulnerabilidades.

- **Relatório Completo**: Os achados e mitigações detalhados estão disponíveis no [Relatório de Varredura Profunda (SecOps)](security-scan-results.md).