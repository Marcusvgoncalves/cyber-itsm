# Especificação Técnica Oficial — CyberITSM SPN

## 1. Visão Geral da Arquitetura & Diretrizes de Projeto

O **CyberITSM SPN** é uma plataforma corporativa especializada em **IT Service Management (ITSM)** para **Cibersegurança e Governança de TI**. Projetado sobre Next.js 16 (App Router), React 19, Supabase PostgreSQL 16 e Prisma ORM v7, o sistema oferece:
- Gestão hierárquica de demandas (estilo Jira/Trello) via **Quadro Kanban & Dashboard Analytics**, com suporte a `Épico`, `Atividade` e `Tarefa`, máquina de estados de status, guardrails de fechamento de Épico e checklist interativo.
- **Centro de Security QA** com motor autônomo de análise de relatórios contra a matriz dos **314 Requisitos Segura SD v4.1**, compressão GZIP forense, expurgo de dados brutos e Dashboard SecOps.
- **Copiloto de IA Multiagente (Zero Downtime)** com esteira de 4 camadas: Groq (Llama 3.3 70B), OpenRouter Free LLMs, Google Gemini 2.0 e Motor Determinístico de Fallback por regras.
- **Portal IAM / IGA & SCIM v2.0 / SAML 2.0**: Barramento de governança de acesso com suporte a SCIM (`/api/scim/v2/Users`), Single Sign-On SAML 2.0 e fila de aprovação Sailpoint JIT.
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
+-----------------------------------------------------------------------------------+
                                          |
                                Server Actions / REST API
                                          v
+-----------------------------------------------------------------------------------+
|            CAMADA BACKEND — Edge Proxy, Middleware & Esteira Multiagente IA       |
|  proxy.ts (Rate Limit Interceptor)          /api/qa-engine (Zod + Stream)         |
|  /api/scim/v2/Users (SCIM v2.0)             /api/saml/sso (SAML 2.0 Metadata)     |
|  ticketRules.ts (Máquina de Estados)       /api/tickets (Hierarquia & Validation) |
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

### 3.2 Centro de Security QA & Dashboard SecOps
- **Localização**: `app/(app)/security-qa/` & `components/security-qa/`
- **Capacidades**:
  - Ingestão de relatórios brutos e anexos documentais de vulnerabilidade (.json, .xml, .txt, .docx, .pdf, .jpg, .png).
  - OCR e parsing de anexos (limite 10MB) cruzando automaticamente os achados com os requisitos de arquitetura via Zod e IA.
  - Security QA Analytics Dashboard com vereditos (`conforme`, `parcial`, `nao_conforme`) e calculadora SecOps: `Score = Severidade * Escopo do Sistema * Exposição de Rede`.
  - Cold Storage em GZIP (.gz) no bucket `qa-logs-archive` e expurgo automático da evidência bruta descomprimida (Zero Data Leak).
  - Exportação nativa de relatórios executivos e auditorias completas em formato PDF compilados via `@react-pdf/renderer`.

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

---

## 4. Estrutura do Banco de Dados (Prisma Schema v7)

```prisma
enum TicketType {
  EPICO
  ATIVIDADE
  TAREFA
}

enum TicketStatus {
  ABERTO
  EM_ANDAMENTO
  BLOQUEADO
  FECHADO
  CANCELADO
}

model Ticket {
  id              String       @id @default(uuid()) @db.Uuid
  title           String
  description     String?
  type            TicketType
  status          TicketStatus @default(ABERTO)
  priority        String       @default("media")
  assignee        String       @map("assignee")
  parentEpicId    String?      @map("parent_epic_id") @db.Uuid
  parentEpic      Ticket?      @relation("EpicHierarchy", fields: [parentEpicId], references: [id], onDelete: SetNull)
  childTickets    Ticket[]     @relation("EpicHierarchy")
  checklist       Json         @default("[]")
  tags            String[]     @default([])
  frameworkOrigem String?      @map("framework_origem")
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")
  closedAt        DateTime?    @map("closed_at")

  @@map("tickets")
}
```

---

## 5. English Architecture & Specification Summary

The **CyberITSM SPN** platform is built on Next.js 16, React 19, Supabase PostgreSQL, and Prisma ORM v7. It features:
- **Hierarchical Kanban Board & Volumetric Analytics**: Jira/Trello-style demand management (`Epic`, `Activity`, `Task`), strict status state machine (`ABERTO`, `EM_ANDAMENTO`, `BLOQUEADO`, `FECHADO`, `CANCELADO`), type immutability, Epic closure dependency guardrail, and interactive checklist component.
- **Security QA Center**: Automated vulnerability report evaluation against the **314 SD v4.1 Requirements**, GZIP cold storage archiving, Zero Data Leak purge, and extensive native PDF generation for reports.
- **4-Tier Multiagent AI Pipeline**: Seamless fallback routing with RAG over security requirements, Strict Cybersecurity persona, and automatic memory hygiene on login.
- **IAM / IGA Portal**: SCIM v2.0 provisioning endpoints (`/api/scim/v2/Users`), SAML 2.0 federated SSO, CSV Audit Logs export, and Sailpoint JIT access request workflows.
- **B2B Integrations & MTLS**: Native setup interfaces for Jira, ServiceNow, and M365 with Mutual TLS certificate handling.
- **Reactive Session & Security**: MFA/TOTP (RFC 6238) enforcement, 1-hour active session limit, 15-minute idle timeout, and per-user local chat history persistence.