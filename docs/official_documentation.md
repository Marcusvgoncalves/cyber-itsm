# Especificação Técnica Oficial — CyberITSM SPN

## 1. Visão Geral da Arquitetura & Diretrizes de Projeto

O **CyberITSM SPN** é uma plataforma corporativa especializada em **IT Service Management (ITSM)** para **Cibersegurança e Governança de TI**. Projetado sobre Next.js 16 (App Router), React 19, Supabase PostgreSQL 16 e Prisma ORM v7, o sistema oferece:
- Gestão hierárquica de demandas (estilo Jira/Trello) via **Quadro Kanban & Dashboard Analytics**, com suporte a `Épico`, `Atividade` e `Tarefa`, máquina de estados de status, guardrails de fechamento de Épico, checklist interativo, **Sprints** e **Due Dates**.
- **Centro de Security QA** com motor autônomo de análise de relatórios contra a matriz dos **314 Requisitos Segura SD v4.1**, compressão GZIP forense, expurgo de dados brutos, Dashboard SecOps e **integração direta Epic QA** via modal dedicado.
- **Copiloto de IA Multiagente (Zero Downtime)** com esteira de resiliência em camadas: Groq (Llama), OpenRouter Free LLMs, Google Gemini 2.0, e **OpenAI GPT-4o Mini** — com logs de consumo de LLM e **motor determinístico de fallback** por regras.
- **Portal IAM / IGA & SCIM v2.0 / SAML 2.0**: Barramento de governança de acesso com suporte a SCIM (`/api/scim/v2/Users`), Single Sign-On SAML 2.0 e fila de aprovação Sailpoint JIT.
- **Painel de Configurações e Cadastros (SoD Admin)**: Módulo restrito de governança com **Matriz SoD** granular, gestão de Sprints, Preferências de Notificação, Matriz Dinâmica de Requisitos customizados e **Painel de Consumo de LLM** por provedor.
- **Trilha de Auditoria & Política de Retenção (Governança SecOps)**: Trilha imutável em `audit_logs` com ciclo de vida em 3 estágios — HOT (0–7 dias) consultável na UI, ARCHIVE (7–90 dias) comprimido em GZIP por dia no `audit_logs_archive` via job diário do Inngest, e PURGE (>90 dias) **somente com consentimento explícito** do aprovador `marcus.goncalves` (`audit_purge_consent`).
- **Sessão Reativa & Autenticação Segura**: Suporte a MFA/TOTP obrigatório (RFC 6238), limite de sessão de **1 hora de uso contínuo** e **15 minutos de inatividade**, com persistência local de chats no `localStorage`.

---

## 2. Desenho de Arquitetura da Solução (C4 Nível 2)

```
+-----------------------------------------------------------------------------------+
|               PERÍMETRO CLIENTE / BROWSER (Sessão 1h / 15m Idle · MFA)            |
|  [Analista SecOps]            [Admin / Gestor IAM]         [Solicitante JIT]     |
+-----------------------------------------------------------------------------------+
                                          |
                                    HTTPS / TLS 1.3
                                          v
+-----------------------------------------------------------------------------------+
|               CAMADA FRONTEND — Next.js 16 App Router (Mistica UI)                |
|  /dashboard (Kanban Hierárquico + Analytics)  /security-qa (Engine + Dashboard QA) |
|  /knowledge-base (314 Requisitos)             /login & /reset-password (MFA TOTP) |
|  /admin/cadastros (Sprints, Notificações, Requisitos Dinâmicos — SoD ADMIN)       |
+-----------------------------------------------------------------------------------+
                                          |
                                Server Actions / REST API
                                          v
+-----------------------------------------------------------------------------------+
|            CAMADA BACKEND — Edge Proxy, Middleware & Esteira Multiagente IA       |
|  proxy.ts (Rate Limit Interceptor)          /api/qa-engine (Zod + Stream)         |
|  /api/scim/v2/Users (SCIM v2.0)             /api/saml/sso (SAML 2.0 Metadata)     |
|  ticketRules.ts (Máquina de Estados)       /api/tickets (Hierarquia & Validation) |
|  cadastros.ts (Sprint/Notification/Req.)   rbac.ts (Matriz SoD 3-Perfis)          |
|                                                                                   |
|  [ESTEIRA MULTIAGENTE IA (4 CAMADAS)]:                                            |
|  1. Groq (Llama 3.3 70B) -> 2. OpenRouter Free -> 3. Gemini 2.0 -> 4. Fallback     |
+-----------------------------------------------------------------------------------+
                                          |
                                  SQL Adapter / Storage API
                                          v
+-----------------------------------------------------------------------------------+
|               CAMADA DE PERSISTÊNCIA, STORAGE FORENSE & RELATÓRIOS PDF            |
|  Supabase PostgreSQL 16 (RLS)              Prisma ORM v7 (SqlDriverAdapter)       |
|  Supabase Storage (qa-logs-archive GZIP)   @react-pdf/renderer (Guia & Laudos PDF) |
|  Tabelas: tickets, sprints, notification_settings, qa_results, audit_logs          |
+-----------------------------------------------------------------------------------+
```

---

## 3. Especificação dos Módulos e Componentes

### 3.1 Módulo Kanban Hierárquico & Dashboard Analytics
- **Localização**: `components/kanban/kanban-board.tsx`, `components/kanban/ticket-modal.tsx`, `components/kanban/kanban-card.tsx`
- **Capacidades**:
  - Classificação hierárquica por tipo: `Épico`, `Atividade` e `Tarefa`.
  - Obrigatoriedade do campo `assignee` e do vínculo com `parentEpicId` para Atividades e Tarefas.
  - Imutabilidade do tipo `type` pós-criação.
  - Máquina de estados estrita: `ABERTO` ➔ `['EM_ANDAMENTO', 'CANCELADO']`, `EM_ANDAMENTO` ➔ `['FECHADO', 'BLOQUEADO', 'CANCELADO']`, `BLOQUEADO` ➔ `['EM_ANDAMENTO', 'CANCELADO']`, `FECHADO` ➔ `['ABERTO', 'EM_ANDAMENTO']`, `CANCELADO`.
  - Guardrail de fechamento de Épico (impede fechar Épico se houver filhas abertas).
  - Componente de checklist interativo com barra de progresso visual % em tempo real.
  - Badges coloridos por tipo e alertas visuais no drag-and-drop inválido.
  - **Sprints**: Associação de chamados a iterações de entrega cadastradas, com badge visual no card.
  - **Due Date**: Campo de vencimento com alertas visuais de proximidade/estouro diretamente no card.

### 3.2 Centro de Security QA & Dashboard SecOps
- **Localização**: `app/(app)/security-qa/` & `components/security-qa/`
- **Capacidades**:
  - Ingestão de relatórios brutos e anexos documentais de vulnerabilidade (.json, .xml, .txt, .docx, .pdf, .jpg, .png).
  - OCR e parsing de anexos (limite 10MB) cruzando automaticamente os achados com os requisitos de arquitetura via Zod e IA.
  - **Pipeline Multiagente Reordenado**: roteador em cascata priorizando **Google Gemini 2.0 (Flash/Lite)** → **OpenAI GPT-4o Mini** → **OpenRouter Free** → **Groq**, com fallback determinístico. Cada chamada (sucesso, falha ou fallback) é persistida em `llm_call_logs` (provedor, modelo, latência, tokens, custo estimado) para o Painel de Consumo de LLM.
  - Security QA Analytics Dashboard com vereditos (`conforme`, `parcial`, `nao_conforme`) e calculadora SecOps: `Score = Severidade * Escopo do Sistema * Exposição de Rede`.
  - Cold Storage em GZIP (.gz) no bucket `qa-logs-archive` e expurgo automático da evidência bruta descomprimida (Zero Data Leak).
  - Exportação nativa de relatórios executivos e auditorias completas em formato PDF compilados via `@react-pdf/renderer`.
  - **Exclusão de análises (ADMIN)**: Server Action `deleteQaAnalysis` remove os artefatos forenses (GZIP + PDF) do Storage, o registro em `qa_results` e projetos órfãos, registrando a ação em `audit_logs`.

### 3.2.1 Epic QA — Integração Kanban ↔ Security QA Engine
- **Localização**: `components/kanban/epic-qa-modal.tsx`
- **Capacidades**:
  - Modal dedicado para submeter Épicos do Kanban ao motor Security QA diretamente.
  - Pré-carregamento inteligente de requisitos SD v4.1 baseado nas tags, framework de origem e título do épico.
  - Execução em stream SSE com barra de progresso de conformidade % em tempo real.
  - Associação automática da sprint vinculada ao épico no laudo gerado.
  - Redirecionamento automático para a página do laudo (`.../project/{id}`) após conclusão.

### 3.3 Copiloto de IA Multiagente (Zero Downtime)
- **Localização**: `app/api/chat/route.ts` & `app/api/qa-engine/route.ts`
- **Capacidades**:
  - Persona Especialista Sênior Estrita em Cibersegurança que higieniza o próprio contexto/memória localmente a cada novo login.
  - Roteamento transparente em cascata entre Groq, OpenRouter e Google Gemini (fallback automático ao primeiro provedor disponível).
  - Esquema estrito Zod para estruturação JSON de resposta.
  - RAG (*Retrieval-Augmented Generation*) integrado consultando o acervo dos 314 Requisitos Segura SD v4.1.
  - **Métricas de Consumo**: chamadas de IA no QA Engine registradas em `llm_call_logs` e consolidadas no Painel de Consumo de LLM (Cadastros).

### 3.4 Portal IAM/IGA e Configurações
- **Localização**: `app/api/scim/v2/Users/route.ts`, `app/api/saml/sso/route.ts`, `app/actions/iam.ts`
- **Capacidades**:
  - Protocolo SCIM v2.0 para criação, leitura, atualização e inativação de identidades por Provedores de Identidade (IdP).
  - SAML 2.0 Single Sign-On federado com suporte a metadados XML.
  - Gestão de solicitações Just-In-Time (JIT) via Sailpoint com papel RBAC e justificativa SecOps.
  - Painel de **Logs de Auditoria** com metadados transacionais (HTTP, IP) e exportação front-end imediata para formato CSV.

### 3.5 Integrações B2B & MTLS Outbound
- **Localização**: `app/(app)/dashboard/dashboard-client.tsx`
- **Capacidades**:
  - **Conectores de Software**: Suporte e configuração de chaves para **Jira Software**, **ServiceNow** e **Microsoft 365**.
  - **Mutual TLS (MTLS)**: Toggle de segurança para injetar obrigatoriedade de apresentação de certificado cliente (`.pem` e `.key`) nas chamadas B2B externas.

### 3.6 Cadastros (Governança SoD Admin)
- **Localização**: `app/(app)/admin/cadastros/page.tsx`, `components/admin/cadastros-client.tsx`, `app/actions/cadastros.ts`, `lib/rbac.ts`
- **Capacidades**:
  - **Matriz SoD (Separation of Duties)** com 3 perfis (`ADMIN`, `USUARIO`, `SOLICITANTE`) e 8 permissões granulares (`sprints:view`, `sprints:manage`, `notifications:view`, `notifications:manage`, `requirements:view`, `requirements:manage`, `users:manage`, `tickets:all`).
  - **Gestão de Sprints**: CRUD completo com nome, objetivo (goal), datas de início/fim, status (Planejada, Ativa, Concluída) e trilha de auditoria.
  - **Preferências de Notificação**: Configuração por evento (chamado criado, atualizado, vencimento, início de sprint) × canal (e-mail, in-app, SMS) com toggles de ativação e sugestão de criação de configurações ausentes.
  - **Matriz Dinâmica de Requisitos**: CRUD completo de requisitos customizados com ID padronizado, controle, criticidade, componente, categoria, STRIDE, OWASP, detalhamento, evidência e procedimento de teste, marcados como `custom=true`.
  - **Proteção por Role Server-Side**: Toda Server Action valida `requireAdmin()` antes de executar operações de escrita.
  - **Auditoria**: Cada operação CRUD gera `createAuditLog()` com `old_data` e `new_data` diferenciais.
  - **Painel de Consumo de LLM**: Aba dedicada (id `consumo-llm`) com métricas reais por provedor (Google Gemini, OpenAI, OpenRouter, Groq) via `getLlmUsageMetrics()` — chamadas, taxa de falhas, tokens consumidos, custo estimado e histórico das últimas transações de IA persistidas em `llm_call_logs`.

### 3.7 Trilha de Auditoria & Política de Retenção (Governança SecOps)
- **Localização**: `lib/audit/audit.ts`, `lib/audit/retention.ts`, `app/actions/audit.ts`, `lib/inngest/functions/auditRetention.ts`
- **Capacidades**:
  - **Trilha imutável (`audit_logs`)**: gravação em tempo real de eventos operacionais e transacionais — `login_success`/`logout` (service role em `auth.ts`), CRUD de chamados (`ticket_create`, `ticket_update`, `ticket_move`, `ticket_delete`), cadastros, requisições/exclusões de QA (`qa_analysis_request`, `qa_analysis_delete`) e consentimentos de expurgo.
  - **Ciclo de Vida em 3 Estágios**:
    - **HOT (0–7 dias)**: logs recentes consultáveis na aba **Auditoria** do Dashboard (`?tab=audit`, restrita a ADMIN) e exportáveis em CSV.
    - **ARCHIVE (7–90 dias)**: job diário do **Inngest** (`auditRetentionJob`, cron `0 3 * * *` UTC) comprime os logs em **GZIP por dia** (`node:zlib`, nível 9) para `audit_logs_archive` (upsert idempotente por `archive_day`) e remove do hot apenas após persistir — sem perda de rastreabilidade forense.
    - **PURGE (>90 dias)**: expurgo definitivo **somente com consentimento explícito** do aprovador `marcus.goncalves` (`audit_purge_consent`, validade de 30 dias renovável). Sem consentimento vigente o job retém tudo e reporta `awaitingConsent`.
  - **Ações administrativas (ADMIN)**: `getAuditRetentionStatusAction` (status da política), `runAuditRetentionNowAction` (execução manual), `grantAuditPurgeConsentAction`/`revokeAuditPurgeConsentAction` (consentimento — restritas ao aprovador `marcus.goncalves`).

---

## 4. Estrutura do Banco de Dados (Prisma Schema v7)

```prisma
enum TicketType {
  EPICO
  ATIVIDADE
  TAREFA
}

model Ticket {
  id              String       @id @default(uuid()) @db.Uuid
  title           String
  description     String?
  type            TicketType
  status          String       @default("ABERTO")
  priority        String       @default("media")
  assignee        String       @map("assignee")
  parentEpicId    String?      @map("parent_epic_id") @db.Uuid
  parentEpic      Ticket?      @relation("EpicHierarchy", fields: [parentEpicId], references: [id], onDelete: SetNull)
  childTickets    Ticket[]     @relation("EpicHierarchy")
  tags            String[]     @default([])
  frameworkOrigem String?      @map("framework_origem")
  reporterId      String?      @map("reporter_id") @db.Uuid
  attachmentName  String?      @map("attachment_name")
  attachmentUrl   String?      @map("attachment_url")
  dueDate         DateTime?    @map("due_date")
  sprintId        String?      @map("sprint_id") @db.Uuid
  sprint          Sprint?      @relation(fields: [sprintId], references: [id], onDelete: SetNull)
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")
  closedAt        DateTime?    @map("closed_at")

  @@map("tickets")
}

model Sprint {
  id        String    @id @default(uuid()) @db.Uuid
  name      String
  goal      String?
  startDate DateTime? @map("start_date")
  endDate   DateTime? @map("end_date")
  status    String    @default("PLANEJADA")
  createdBy String?   @map("created_by") @db.Uuid
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  tickets   Ticket[]

  @@map("sprints")
}

model NotificationSetting {
  id          String   @id @default(uuid()) @db.Uuid
  eventType   String   @map("event_type")
  channel     String   @default("email")
  enabled     Boolean  @default(true)
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@unique([eventType, channel])
  @@map("notification_settings")
}

model LlmCallLog {
  id         String   @id @default(uuid()) @db.Uuid
  provider   String   // google | openai | openrouter | groq | fallback
  model      String
  route      String   // ex: /api/qa-engine, /api/chat
  status     String   // SUCESSO | FALLBACK | FALHA
  latencyMs  Int      @map("latency_ms")
  tokensUsed Int?     @map("tokens_used")
  costEst    Decimal? @map("cost_est") @db.Decimal(10, 6)
  createdAt  DateTime @default(now()) @map("created_at")

  @@index([provider])
  @@index([createdAt(sort: Desc)])
  @@map("llm_call_logs")
}
```

> **Tabelas complementares de governança (Supabase, fora do Prisma)**:
> - `audit_logs` — trilha imutável de auditoria (HOT 0–7 dias), com `user_id`, `action`, `entity_type`, `entity_id`, `old_data`/`new_data` (JSONB), `ip_address`, `user_agent` e `created_at`.
> - `audit_logs_archive` — arquivo frio com os logs comprimidos em **GZIP por dia** (7–90 dias): `archive_day` (UNIQUE), `payload_gz` (BYTEA), `row_count`, `original_bytes`, `compressed_bytes`, `compression_ratio` e `purged_at`.
> - `audit_purge_consent` — consentimento de expurgo (>90 dias), validade de 30 dias, restrito ao aprovador `marcus.goncalves`; status `GRANTED | REVOKED | EXECUTED` com `granted_at`, `expires_at`, `revoked_at` e `executed_at`.

---

## 5. Matriz SoD (Separation of Duties) — RBAC

```
┌─────────────────────┬────────────────────────────────────────────────────┐
│ Perfil SoD          │ Permissões                                       │
├─────────────────────┼────────────────────────────────────────────────────┤
│ ADMIN               │ sprints:view, sprints:manage, notifications:view, │
│ (role: admin)       │ notifications:manage, requirements:view,          │
│                     │ requirements:manage, users:manage, tickets:all    │
├─────────────────────┼────────────────────────────────────────────────────┤
│ USUARIO             │ sprints:view, notifications:view,                 │
│ (role: analista)    │ requirements:view, tickets:all                    │
├─────────────────────┼────────────────────────────────────────────────────┤
│ SOLICITANTE         │ sprints:view, notifications:view,                 │
│ (role: solicitante) │ requirements:view                                 │
└─────────────────────┴────────────────────────────────────────────────────┘
```

---

## 7. Mapeamento de APIs e URLs (Catálogo de Rotas)

Abaixo está o catálogo completo de rotas navegáveis do frontend (URLs) e endpoints REST/serviços expostos (APIs) da plataforma.

### 7.1 Rotas Frontend (Páginas / URLs)
- `/login`: Portal de autenticação corporativa (`nome.sobrenome`) e segundo fator MFA/TOTP obrigatório.
- `/reset-password`: Recuperação autônoma de senha corporativa.
- `/dashboard`: Painel principal unificado. Suporta as seguintes abas internas reativas:
  - `?tab=kanban` (padrão): Quadro Kanban Hierárquico e Dashboard Analytics.
  - `?tab=iam`: Portal IAM/IGA e Configurações (gerenciamento de acessos e preferências locais).
  - `?tab=audit`: Painel de Logs de Auditoria operacional e transacional, incluindo a **Política de Retenção** (status HOT/ARCHIVE/PURGE, consentimento de expurgo e execução manual) (Restrito a `ADMIN`).
  - `?tab=architecture`: Visualizador dinâmico de arquitetura da solução C4 Nível 2 (Restrito a `ADMIN`).
- `/admin/cadastros`: Painel Administrativo de Cadastros (Restrito a `ADMIN` via SoD). Contém abas para gerenciamento de Sprints, Matriz de Requisitos customizados, Gatilhos de Notificação e **Consumo de LLM**.
- `/security-qa`: Centro de análise do Security QA.
- `/security-qa/assess`: Sandbox de envio e ingestão rápida de relatórios de vulnerabilidade e OCR.
- `/security-qa/project/[id]`: Laudo de conformidade e auditoria estruturada gerado de um projeto ou épico.
- `/knowledge-base`: Base de Conhecimento interativa dos 314 Requisitos Segura SD v4.1.

### 7.2 APIs e Endpoints do Backend (Serviços REST)
- `POST /api/chat`: Copiloto IA global com esteira de 4 camadas e resiliência a timeouts/erros.
- `POST /api/qa-engine`: Endpoint de submissão do Security QA que registra o laudo em status `PROCESSANDO` e publica o evento no Inngest, retornando resposta imediata de forma assíncrona.
- `GET/POST /api/inngest`: Endpoint do servidor Inngest que gerencia a fila e executa o processamento em background da esteira de análise (OCR, IA e compilação de PDF).
- `POST /api/emails/notify`: API interna para envio de e-mails transacionais com encapsulamento síncrono para o Resend.
- `POST /api/oauth/token`: Endpoint de emissão de tokens OAuth 2.0.
- `GET /api/oauth/userinfo`: Endpoint OAuth 2.0 UserInfo para federação de identidades.
- `GET /api/saml/metadata`: Exportação de metadados XML SAML 2.0 da plataforma.
- `POST /api/saml/sso`: Endpoint receptor de asserções SAML 2.0 (Single Sign-On).
- `GET /api/scim/v2/Users`: Listagem paginada e busca de usuários integrada pelo barramento SCIM v2.0.
- `POST /api/scim/v2/Users`: Criação/provisionamento de identidades via SCIM.
- `GET/PUT/PATCH/DELETE /api/scim/v2/Users/[id]`: Operações individuais e atualizações parciais do ciclo de vida SCIM.
- `GET /api/tickets`: Acesso programático a dados básicos de chamados.
- `GET /api/tickets/[id]/pdf`: Compilação e exportação nativa sob demanda de chamado/requisitos em formato PDF.
- `GET /api/security-qa/[id]/pdf`: Exportação nativa do laudo estruturado de conformidade de QA em PDF.

---

## 8. English Architecture & Specification Summary

The **CyberITSM SPN** platform is built on Next.js 16, React 19, Supabase PostgreSQL, and Prisma ORM v7. It features:
- **Hierarchical Kanban Board & Volumetric Analytics**: Jira/Trello-style demand management (`Epic`, `Activity`, `Task`), strict status state machine (`ABERTO`, `EM_ANDAMENTO`, `BLOQUEADO`, `FECHADO`, `CANCELADO`), type immutability, Epic closure dependency guardrail, interactive checklist component, **Sprint management** and **Due Date** tracking.
- **Security QA Center**: Automated vulnerability report evaluation against the **314 SD v4.1 Requirements** processed asynchronously via **Inngest** background jobs, GZIP cold storage archiving, Zero Data Leak purge, extensive native PDF generation, and **Epic QA integration** (direct Kanban-to-QA engine pipeline).
- **Multiagent AI Copilot (Zero Downtime)**: Layered resilience pipeline — **Google Gemini 2.0 (Flash/Lite)** → **OpenAI GPT-4o Mini** → **OpenRouter Free LLMs** → **Groq** — with deterministic rule-based fallback, strict Cybersecurity persona, RAG over the 314 SD v4.1 requirements, and automatic memory hygiene on login. Every call is persisted to `llm_call_logs` (provider, model, latency, tokens, estimated cost) for the LLM Consumption Panel.
- **IAM / IGA Portal**: SCIM v2.0 provisioning endpoints (`/api/scim/v2/Users`), SAML 2.0 federated SSO, CSV Audit Logs export, and Sailpoint JIT access request workflows.
- **B2B Integrations & MTLS**: Native setup interfaces for Jira, ServiceNow, and M365 with Mutual TLS certificate handling.
- **Registrations (SoD Admin Panel)**: Governance module with **SoD Matrix** (3 profiles, 8 permissions), Sprint CRUD, Notification Preferences, Dynamic Security Requirements Matrix, and **LLM Consumption Panel** with real per-provider metrics (Google Gemini, OpenAI, OpenRouter, Groq) — call counts, failure rate, tokens used, and estimated cost. All write operations are server-side ADMIN-gated with full audit logging.
- **Audit Trail & Retention Policy (SecOps Governance)**: Immutable `audit_logs` trail with a **3-stage lifecycle** — HOT (0–7 days) queryable in the Dashboard Audit tab, ARCHIVE (7–90 days) compressed per-day into **GZIP** (`node:zlib`, level 9) into `audit_logs_archive` via a daily **Inngest** job (03:00 UTC), and PURGE (>90 days) **only with explicit consent** from approver `marcus.goncalves` (`audit_purge_consent`, renewable 30-day validity). ADMIN can view policy status, run the routine manually, and grant/revoke purge consent.
- **Reactive Session & Security**: MFA/TOTP (RFC 6238) enforcement, 1-hour active session limit, 15-minute idle timeout, and per-user local chat history persistence.
- **API & Route Coverage**: Unified routing structure providing 8 user interface paths and 15 backend service/integration API endpoints.