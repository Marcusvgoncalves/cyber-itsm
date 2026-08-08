# Especificação Técnica Oficial — CyberITSM SPN

## 1. Visão Geral da Arquitetura & Diretrizes de Projeto

O **CyberITSM SPN** é uma plataforma corporativa especializada em **IT Service Management (ITSM)** para **Cibersegurança e Governança de TI**. Projetado sobre Next.js 16 (App Router), React 19, Supabase PostgreSQL 16 e Prisma ORM v7, o sistema oferece:
- Gestão hierárquica de demandas (estilo Jira/Trello) via **Quadro Kanban & Dashboard Analytics**, com suporte a `Épico`, `Atividade` e `Tarefa`, máquina de estados de status, guardrails de fechamento de Épico, checklist interativo, **Sprints** e **Due Dates**.
- **Centro de Security QA** com motor autônomo de análise de relatórios contra a matriz dos **314 Requisitos Segura SD v4.1**, compressão GZIP forense, expurgo de dados brutos, Dashboard SecOps e **integração direta Epic QA** via modal dedicado.
- **Copiloto de IA Multiagente (Zero Downtime)** com esteira de 4 camadas: Groq (Llama 3.3 70B), OpenRouter Free LLMs, Google Gemini 2.0 e Motor Determinístico de Fallback por regras.
- **Portal IAM / IGA & SCIM v2.0 / SAML 2.0**: Barramento de governança de acesso com suporte a SCIM (`/api/scim/v2/Users`), Single Sign-On SAML 2.0 e fila de aprovação Sailpoint JIT.
- **Painel de Configurações e Cadastros (SoD Admin)**: Módulo restrito de governança com **Matriz SoD** granular, gestão de Sprints, Preferências de Notificação e Matriz Dinâmica de Requisitos customizados.
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
  - Security QA Analytics Dashboard com vereditos (`conforme`, `parcial`, `nao_conforme`) e calculadora SecOps: `Score = Severidade * Escopo do Sistema * Exposição de Rede`.
  - Cold Storage em GZIP (.gz) no bucket `qa-logs-archive` e expurgo automático da evidência bruta descomprimida (Zero Data Leak).
  - Exportação nativa de relatórios executivos e auditorias completas em formato PDF compilados via `@react-pdf/renderer`.

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
  - Roteamento transparente em cascata entre Groq, OpenRouter, Google Gemini e Motor Determinístico.
  - Esquema estrito Zod para estruturação JSON de resposta.
  - RAG (*Retrieval-Augmented Generation*) integrado consultando o acervo dos 314 Requisitos Segura SD v4.1.

### 3.4 Portal IAM / IGA & Logs Transacionais
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

### 3.6 Configurações e Cadastros (Governança SoD Admin)
- **Localização**: `app/(app)/admin/cadastros/page.tsx`, `components/admin/cadastros-client.tsx`, `app/actions/cadastros.ts`, `lib/rbac.ts`
- **Capacidades**:
  - **Matriz SoD (Separation of Duties)** com 3 perfis (`ADMIN`, `USUARIO`, `SOLICITANTE`) e 8 permissões granulares (`sprints:view`, `sprints:manage`, `notifications:view`, `notifications:manage`, `requirements:view`, `requirements:manage`, `users:manage`, `tickets:all`).
  - **Gestão de Sprints**: CRUD completo com nome, objetivo (goal), datas de início/fim, status (Planejada, Ativa, Concluída) e trilha de auditoria.
  - **Preferências de Notificação**: Configuração por evento (chamado criado, atualizado, vencimento, início de sprint) × canal (e-mail, in-app, SMS) com toggles de ativação e sugestão de criação de configurações ausentes.
  - **Matriz Dinâmica de Requisitos**: CRUD completo de requisitos customizados com ID padronizado, controle, criticidade, componente, categoria, STRIDE, OWASP, detalhamento, evidência e procedimento de teste, marcados como `custom=true`.
  - **Proteção por Role Server-Side**: Toda Server Action valida `requireAdmin()` antes de executar operações de escrita.
  - **Auditoria**: Cada operação CRUD gera `createAuditLog()` com `old_data` e `new_data` diferenciais.

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
```

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

## 6. English Architecture & Specification Summary

The **CyberITSM SPN** platform is built on Next.js 16, React 19, Supabase PostgreSQL, and Prisma ORM v7. It features:
- **Hierarchical Kanban Board & Volumetric Analytics**: Jira/Trello-style demand management (`Epic`, `Activity`, `Task`), strict status state machine (`ABERTO`, `EM_ANDAMENTO`, `BLOQUEADO`, `FECHADO`, `CANCELADO`), type immutability, Epic closure dependency guardrail, interactive checklist component, **Sprint management** and **Due Date** tracking.
- **Security QA Center**: Automated vulnerability report evaluation against the **314 SD v4.1 Requirements**, GZIP cold storage archiving, Zero Data Leak purge, extensive native PDF generation, and **Epic QA integration** (direct Kanban-to-QA engine pipeline with SSE streaming).
- **4-Tier Multiagent AI Pipeline**: Seamless fallback routing with RAG over security requirements, Strict Cybersecurity persona, and automatic memory hygiene on login.
- **IAM / IGA Portal**: SCIM v2.0 provisioning endpoints (`/api/scim/v2/Users`), SAML 2.0 federated SSO, CSV Audit Logs export, and Sailpoint JIT access request workflows.
- **B2B Integrations & MTLS**: Native setup interfaces for Jira, ServiceNow, and M365 with Mutual TLS certificate handling.
- **Settings & Registration (SoD Admin Panel)**: Governance module with **SoD Matrix** (3 profiles, 8 permissions), Sprint CRUD, Notification Preferences, and Dynamic Security Requirements Matrix. All write operations are server-side ADMIN-gated with full audit logging.
- **Reactive Session & Security**: MFA/TOTP (RFC 6238) enforcement, 1-hour active session limit, 15-minute idle timeout, and per-user local chat history persistence.