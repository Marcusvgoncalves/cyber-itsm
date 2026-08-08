# CyberITSM SPN — Plataforma Corporativa de Cibersegurança & Governança

[![Next.js 16](https://img.shields.io/badge/Next.js-16.3.0-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb?logo=react)](https://react.dev/)
[![Prisma ORM 7](https://img.shields.io/badge/Prisma-7.9.1-2d3748?logo=prisma)](https://www.prisma.io/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%2016-3ecf8e?logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-Proprietary-660099.svg)](LICENSE)

> **CyberITSM SPN** é uma plataforma corporativa de *IT Service Management* (ITSM) voltada à Cibersegurança, Gestão Hierárquica de Demandas (Jira/Trello), Esteira DevSecOps Multiagente, Auditoria Autônoma de Conformidade sobre a Matriz dos 314 Requisitos Segura SD v4.1, **Portal IAM/IGA e Configurações** e **Painel de Cadastros com Segregação de Funções (SoD)**.

---

## 🇧🇷 Documentação em Português

### 🌐 Visão Geral da Arquitetura (C4 Nível 2)

A arquitetura do sistema foi projetada no padrão de alta disponibilidade e resiliência sem ponto único de falha (*Zero Downtime*), combinando execução Serverless Edge na Vercel com banco PostgreSQL no Supabase, inteligência multiagente e barramento SCIM v2.0 / SAML 2.0. A camada de governança conta com **Matriz SoD (Separation of Duties)** granular para segregação de funções entre perfis ADMIN, USUARIO e SOLICITANTE.

![Desenho de Arquitetura CyberITSM SPN](public/images/architecture.svg)

### 🔄 Fluxo de Funcionamento & Ciclo de Vida de Demandas

![Fluxo de Funcionamento CyberITSM SPN](public/images/workflow.png)

---

### 🚀 Módulos e Funcionalidades Principais

#### 1. 📋 Quadro Kanban Hierárquico & Dashboard Analytics
- **Gestão Hierárquica Jira/Trello**:
  - Classificação de demandas por tipo: **Épico** (macro demanda), **Atividade** e **Tarefa**.
  - Vínculo **obrigatorio** de Atividades e Tarefas a um Épico Pai existente.
  - **Imutabilidade do Tipo**: O tipo do chamado é congelado pós-criação e não pode ser alterado na edição.
  - **Campo Responsável Obrigatório**: Todo chamado exige a atribuição expressa do Responsável (`assignee`).
- **Máquina de Estados de Status**:
  - Transições controladas por matriz estrita: `ABERTO` ➔ `['EM_ANDAMENTO', 'CANCELADO']`, `EM_ANDAMENTO` ➔ `['FECHADO', 'BLOQUEADO', 'CANCELADO']`, `BLOQUEADO` ➔ `['EM_ANDAMENTO', 'CANCELADO']`, `FECHADO` ➔ `['ABERTO', 'EM_ANDAMENTO']` (Reabertura), `CANCELADO` (Estado Terminal).
  - **Guardrail de Fechamento de Épicos**: Um Épico SÓ PODE ser movido para `FECHADO` se todas as suas filhas (Atividades/Tarefas) estiverem em `FECHADO` ou `CANCELADO`.
- **Componente de Checklist Integrado**:
  - Inserção dinâmica, alternância de conclusão e remoção de itens de validação com barra de progresso visual % em tempo real.
- **Sprint & Due Date Management**:
  - Associação de chamados a **Sprints** cadastradas (Planejada, Ativa, Concluída).
  - Campo **Due Date** (data de vencimento) com alertas visuais de proximidade/estouro.
  - Badges de sprint e data limite diretamente nos cards do Kanban.
- **Visualização & Dashboard Analytics**:
  - Badges coloridos por tipo (Épico: Roxo, Atividade: Azul, Tarefa: Verde) e tag com título do Épico Pai.
  - **Alerta Visual de Drag-and-Drop**: Bloqueio imediato com aviso amigável ao tentar arrastar card para coluna cujo fluxo de status seja inválido.
  - **Calculadora de Criticidade Interativa**: Avalia o impacto técnico do ticket cruzando `Prioridade * Framework * SLA`.

#### 2. 🛡️ Centro de Security QA & Dashboard SecOps
- **Engine de Análise Autônoma (`/api/qa-engine`)**: Ingestão de relatórios de varredura bruta e anexos documentais (JSON, XML, TXT, DOCX, PDF, JPG, PNG). O motor registra a transação e enfileira o processamento em background de forma assíncrona via **Next.js `after()`** e **Inngest**, garantindo execução contínua no ecossistema Serverless sem congelamento da requisição HTTP.
- **Esteira Multiagente de 5 Camadas de Resiliência**: Roteador em cascata priorizando **Google Gemini 2.0 (Flash/Lite)** ➔ **OpenAI GPT-4o Mini** ➔ **OpenRouter Free** ➔ **Groq Engine** ➔ **Motor Determinístico por Regras de Contingência**. Cada chamada de IA é registrada na tabela física `llm_call_logs` com provedor, modelo, rota, latência ms, tokens e custo estimado.
- **Epic QA — Integração Kanban ↔ Security QA**: Épicos do quadro Kanban podem ser submetidos diretamente ao motor Security QA via modal dedicado. O sistema pré-carrega os requisitos SD v4.1 relacionados ao épico (tags, framework de origem) e executa a análise em segundo plano via worker assíncrono.
- **Security QA Analytics Dashboard**:
  - **Volumetria de Vereditos**: Gráficos Recharts detalhando o acumulado de itens `Conforme`, `Parcial` e `Não Conforme`.
  - **Calculadora SecOps de Impacto**: Fórmula dinâmica `Severidade Vulnerabilidade * Escopo do Sistema * Exposição de Rede` com badges interativos de risco.
- **Cold Storage GZIP & Expurgo**: Comprime os artefatos anexados e relatórios em GZIP (.gz), salvando no Supabase Storage (`qa-logs-archive`) e realizando o expurgo da evidência temporária.
- **Relatórios Executivos em PDF**: Exportação de relatórios compilados nativamente via `@react-pdf/renderer` com importação nomeada `renderToBuffer` para estabilidade no bundler Serverless.

#### 3. 🤖 Copiloto de IA Multiagente & Contingência (Zero Downtime)
Esteira de resiliência encadeada com RAG sobre os 314 Requisitos. O Copiloto opera com a persona de **Especialista Sênior em Cibersegurança** e conta com a **Camada 5 — Motor Determinístico de Segurança**, que utiliza o `SystemContext` acumulado a partir de todas as interações dos usuários na plataforma (total de chamados, projetos e índice de compliance médio histórico) para gerar análises contextualizadas caso todas as APIs externas estejam indisponíveis.

#### 4. 🔑 Portal IAM/IGA e Configurações (Reorganizado & UX Aprimorada)
- **Sub-Navegação por Abas Dinâmicas (`iamSubTab`)**: Interface responsiva e compacta dividida em 4 categorias operacionais que eliminam espaços vazios:
  1. **Provedores & Integrações**: Gestão de IdPs (Entra ID, Keycloak, OAM WebGate) + Conexões `OAuth2`, `SAML 2.0`, `SCIM 2.0` (`IntegrationConnections`) e Conectores Enterprise (`EnterpriseTools` Jira/ServiceNow/O365).
  2. **Identidades Sincronizadas**: Tabela responsiva de identidades federadas com busca dinâmica por nome, e-mail, departamento e provedor.
  3. **Workflows JIT & Aprovações**: Fila de solicitações Just-In-Time (SailPoint IGA) com botões de aprovação/rejeição em um clique + Formulário JIT + Cadastro de Contas Locais.
  4. **Usuários do Sistema & Controles MFA**: Tabela de gestão de contas locais ativas com RBAC (`admin`, `analista`, `solicitante`), status de MFA (2FA), bloqueio/desbloqueio, liberação de senha e desprovisionamento.
- **KPIs em Tempo Real**: Métricas de Identidades Sincronizadas, Pendências JIT, Usuários com MFA Ativo e Requisições no topo da tela.

#### 5. 📚 Base de Conhecimento SD v4.1 (314 Requisitos)
- Catálogo interativo navegável dos **314 Requisitos de Segurança de Desenvolvimento**.
- Filtros por criticidade (Crítico, Alto, Médio, Baixo) e busca instantânea.
- Mapeamento explícito com os frameworks: **NIST CSF**, **CIS Controls**, **OWASP Top 10**, **ISO 27001** e vetores de ameaça **STRIDE LM**.

#### 6. 🔌 Conectores Outbound, MTLS & Logs de Auditoria CSV
- **Conectores Nativos B2B**: Interfaces dedicadas para integração externa com **Jira Software**, **ServiceNow** e **Microsoft 365**.
- **Segurança MTLS (Mutual TLS)**: Suporte para exigência de certificados de cliente (`.pem/.crt` e `.key`) para conexões outbound seguras.
- **Auditoria Transacional e Exportação CSV**: Rastreabilidade imutável de eventos operacionais com download em formato CSV.

#### 7. ⚙️ Cadastros & Painel de Consumo de LLM (Admin SoD)
- **Matriz SoD (Separation of Duties)**: Acesso de escrita restrito ao perfil ADMIN (`requireAdmin()`).
- **Gestão de Sprints & Notificações**: CRUD de iterações de entrega e preferências de notificação por evento × canal.
- **Matriz Dinâmica de Requisitos**: CRUD de requisitos customizados de segurança.
- **Aba de Consumo de LLM com Inteligência de Renovação de Cotas**:
  - Exibição de métricas reais da tabela `llm_call_logs` para Google Gemini, OpenAI, OpenRouter e Groq.
  - **Inteligência no Cálculo de Renovação de Cotas (`calculateTokenRenewal`)**: Exibe a data/hora exata do próximo reset, contagem regressiva de tempo restante (ex: `6h 12m restantes`) e o ciclo (`Diário 00:00 UTC` para free tiers vs `Mensal Dia 1` para planos pagos).

#### 8. 🛡️ Trilha de Auditoria & Política de Retenção (Governança SecOps)
- **Trilha de Auditoria Imutável (`audit_logs`)**: Gravação de logins/logouts, CRUD de chamados, movimentações Kanban, cadastros e requisições de QA.
- **Ciclo em 3 Estágios**: **HOT** (0–7 dias no DB), **ARCHIVE** (7–90 dias GZIP no Storage via Inngest) e **PURGE** (>90 dias expurgo definitivo mediante consentimento de `marcus.goncalves`).
- **Ações administrativas (ADMIN)**: Consultar o status da política, executar a rotina manualmente e conceder/revogar o consentimento de expurgo diretamente na aba Auditoria.

---

### 🔐 Política de Sessão & Autenticação

- **Formato de Login**: Credencial corporativa (`nome.sobrenome`) e senha forte (mínimo 12 caracteres).
- **MFA/TOTP Obrigatório**: Autenticação de segundo fator via aplicativos autenticadores (RFC 6238).
- **Sessão Reativa**:
  - **Sessão em Uso**: Expira em **1 hora de uso contínuo**, mantendo o histórico de trabalho.
  - **Sessão Inativa**: Expira em **15 minutos de inatividade** (idle timeout).
- **Persistência de Histórico**: As conversas do Copiloto de IA ficam salvas no `localStorage` por usuário, preservando o contexto pós-logoff.

---

## 🇬🇧 English Documentation

### 🌐 Architecture Overview (C4 Level 2)

The architecture is designed for high availability and zero single points of failure (*Zero Downtime*). It combines Serverless Edge execution on Vercel with PostgreSQL database on Supabase, multiagent LLM resiliency, and a SCIM v2.0 / SAML 2.0 governance bus. The governance layer includes a granular **SoD (Separation of Duties) Matrix** for function segregation across ADMIN, USER, and REQUESTER profiles.

![CyberITSM SPN Architecture Diagram](public/images/architecture.svg)

### 🔄 Operational Workflow & Demand Lifecycle

![CyberITSM SPN Workflow](public/images/workflow.png)

---

### 🚀 Key Modules and Features

#### 1. 📋 Hierarchical Kanban Board & Analytics Dashboard
- **Jira/Trello-Style Demand Hierarchy**:
  - Ticket types: **Epic** (macro feature), **Activity**, and **Task**.
  - Mandatory linking of Activities and Tasks to an existing **Parent Epic**.
  - **Type Immutability**: Ticket type is locked upon creation and cannot be changed during edits.
  - **Mandatory Assignee Field**: Every ticket requires an assigned owner (`assignee`).
- **Strict Status State Machine**:
  - Controlled transitions: `ABERTO` ➔ `['EM_ANDAMENTO', 'CANCELADO']`, `EM_ANDAMENTO` ➔ `['FECHADO', 'BLOQUEADO', 'CANCELADO']`, `BLOQUEADO` ➔ `['EM_ANDAMENTO', 'CANCELADO']`, `FECHADO` ➔ `['ABERTO', 'EM_ANDAMENTO']` (Reopen), `CANCELADO` (Terminal State).
  - **Epic Closing Guardrail**: An Epic CANNOT be moved to `FECHADO` unless all its child items (Activities/Tasks) are in `FECHADO` or `CANCELADO`.
- **Integrated Interactive Checklist**:
  - Dynamic item addition, completion toggle, and removal with real-time visual progress percentage bar.
- **Sprint & Due Date Management**:
  - Link tickets to registered **Sprints** (Planned, Active, Completed).
  - **Due Date** field with visual proximity/overdue alerts.
  - Sprint and due date badges directly on Kanban cards.
- **Visuals & Analytics**:
  - Color badges per type (Epic: Purple, Activity: Blue, Task: Green) and Parent Epic tag.
  - **Drag-and-Drop Visual Alert**: Instant block and friendly warning banner if dragging to an invalid status transition column.
  - **Interactive Criticality Calculator**: Technical impact evaluation using `Priority * Framework * SLA Window`.

#### 2. 🛡️ Security QA Center & SecOps Dashboard
- **Autonomous QA Engine (`/api/qa-engine`)**: Ingests raw scan logs and document attachments (JSON, XML, TXT, DOCX, PDF, JPG, PNG). The engine registers the report and enqueues it for asynchronous background processing via **Next.js `after()`** and **Inngest**, ensuring uninterrupted serverless execution without HTTP request timeouts.
- **5-Layer Resilient Multiagent Pipeline**: Cascading router prioritizing **Google Gemini 2.0 (Flash/Lite)** ➔ **OpenAI GPT-4o Mini** ➔ **OpenRouter Free** ➔ **Groq Engine** ➔ **Rule-Based Deterministic Contingency Engine**. Every AI call is logged in the `llm_call_logs` table with provider, model, route, latency (ms), tokens, and estimated cost.
- **Epic QA — Kanban ↔ Security QA Integration**: Epics from the Kanban board can be submitted directly to the Security QA engine via a dedicated modal. The system pre-loads SD v4.1 requirements related to the epic and runs background analysis via asynchronous worker queues.
- **Security QA Analytics Dashboard**:
  - **Verdicts Volume**: Recharts graphics detailing `Conforming`, `Partial`, and `Non-Conforming` counts.
  - **SecOps Risk Calculator**: Dynamic formula `Vulnerability Severity * System Scope * Network Exposure` with interactive badges.
- **GZIP Cold Storage & Purge**: Compresses attached artifacts and raw evidence into GZIP (.gz), storing them in Supabase Storage (`qa-logs-archive`), and purging temporary files.
- **PDF Executive Reports**: Full export of audit reports, evaluated projects, and structured PDF reports natively compiled via `@react-pdf/renderer` with named `renderToBuffer` import for serverless stability.

#### 3. 🤖 Multiagent AI Copilot & Contingency (Zero Downtime)
A resilient fallback pipeline with RAG capabilities over the 314 security requirements. The Copilot operates with a **Senior Cybersecurity Expert** persona and features **Tier 5 — Rule-Based Security Engine**, which leverages the accumulated `SystemContext` from all user interactions on the platform (total tickets, projects, and historical average compliance rate) to generate contextualized security advice if all external APIs are unreachable.

#### 4. 🔑 Portal IAM/IGA and Settings (Reorganized & Enhanced UX)
- **Sub-Tab Navigation (`iamSubTab`)**: Responsive compact UI structured into 4 operational categories that eliminate empty space:
  1. **Providers & Integrations**: IdP Management (Entra ID, Keycloak, OAM WebGate) + `OAuth2`, `SAML 2.0`, `SCIM 2.0` Connections (`IntegrationConnections`) & Enterprise Connectors (`EnterpriseTools` Jira/ServiceNow/O365).
  2. **Synced Identities**: Responsive table of federated identities with real-time search by name, email, department, and IdP provider.
  3. **Workflows JIT & Approvals**: Just-In-Time access request queue (SailPoint IGA) with 1-click approve/reject + JIT Request Form + Local Account Creation.
  4. **System Users & MFA Controls**: Active local user management table with RBAC (`admin`, `analista`, `solicitante`), MFA status (2FA), lock/unlock, password reset, and deprovisioning.
- **Real-time Header KPIs**: Counters for Synced Identities, Pending JIT Approvals, Active MFA %, and Access Requests at the top of the tab.

#### 5. 📚 SD v4.1 Knowledge Base (314 Requirements)
- Interactive searchable catalog of **314 Secure Development Requirements**.
- Filter by criticality (Critical, High, Medium, Low) and keyword search.
- Explicit mapping to industry frameworks: **NIST CSF**, **CIS Controls**, **OWASP Top 10**, **ISO 27001**, and **STRIDE LM** threat vectors.

#### 6. 🔌 Outbound Connectors, MTLS & CSV Audit Logs
- **B2B Native Connectors**: Dedicated interfaces for external integration with **Jira Software**, **ServiceNow**, and **Microsoft 365**.
- **MTLS Security (Mutual TLS)**: Support for client certificate requirement (`.pem/.crt` and `.key`) for secure outbound connections.
- **Transactional Audit and CSV Export**: Immutable traceability of operational events with instant CSV download.

#### 7. ⚙️ Registrations & LLM Usage Panel (SoD Admin)
- **Separation of Duties (SoD Matrix)**: Write access restricted to ADMIN profile (`requireAdmin()`).
- **Sprint Management & Notification Preferences**: Full CRUD for delivery iterations and event × channel notification triggers.
- **Dynamic Requirements Matrix**: CRUD for custom security requirements.
- **LLM Consumption Tab with Token Renewal Intelligence**:
  - Displays real transaction telemetry from `llm_call_logs` for Google Gemini, OpenAI, OpenRouter, and Groq.
  - **Quota Renewal Calculation Intelligence (`calculateTokenRenewal`)**: Displays exact next reset date/time, countdown of remaining time (e.g., `6h 12m remaining`), and cycle (`Daily 00:00 UTC` for free tiers vs `Monthly Day 1` for paid accounts).

#### 8. 🛡️ Audit Trail & Retention Policy (SecOps Governance)
- **Immutable Audit Trail (`audit_logs`)**: Real-time recording of logins/logouts, ticket CRUD, Kanban moves, registrations, consents, and QA requests.
- **3-Stage Lifecycle**: **HOT** (0–7 days in DB), **ARCHIVE** (7–90 days per-day GZIP in Storage via Inngest), and **PURGE** (>90 days permanent deletion subject to `marcus.goncalves` consent).
- **Admin actions (ADMIN)**: View policy status, run the routine manually, and grant/revoke purge consent directly from the Audit tab.

---

### 💻 Stack Tecnológica / Tech Stack

- **Framework Core**: Next.js 16.3 (App Router, Turbopack) & React 19
- **ORM / Database**: Prisma ORM 7.9 with `SqlDriverAdapter` + Supabase PostgreSQL 16
- **AI Infrastructure**: Vercel AI SDK 3.3, Groq, OpenRouter, Google Gemini, OpenAI GPT-4o Mini, Zod Schemas
- **UI & Styling**: Tailwind CSS v4, Recharts, Lucide Icons, Radix UI
- **Storage & PDF**: Supabase Storage (`qa-logs-archive`), `@react-pdf/renderer`
- **Security & Governance**: RBAC/SoD Matrix, SCIM v2.0, SAML 2.0, MTLS, MFA/TOTP (RFC 6238)

---

### ⚙️ Guia de Instalação e Execução / Setup Guide

#### 1. Clonar o Repositório & Instalar Dependências
```bash
git clone https://github.com/Marcusvgoncalves/cyber-itsm.git
cd cyber-itsm
npm install
```

#### 2. Configurar Variáveis de Ambiente (`.env.local`)
Crie o arquivo `.env.local` com as chaves:
```env
NEXT_PUBLIC_SUPABASE_URL="https://sua-instancia.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sua-chave-anon"
SUPABASE_SERVICE_ROLE_KEY="sua-chave-service-role"
DATABASE_URL="postgresql://postgres:senha@db.sua-instancia.supabase.co:5432/postgres"

# Provedores de IA (Fallback Multiagente)
GROQ_API_KEY="gsk_..."
OPENROUTER_API_KEY="sk-or-..."
GEMINI_API_KEY="AIzaSy..."
```

#### 3. Gerar Prisma Client & Executar Localmente
```bash
npx prisma generate
npm run dev
```
Acesse [http://localhost:3000](http://localhost:3000).

---

### 📜 Licença e Direitos

Projeto mantido e desenvolvido sob especificações corporativas de Cibersegurança e Governança de TI. Todos os direitos reservados.