# CyberITSM SPN — Plataforma Corporativa de Cibersegurança & Governança

[![Next.js 16](https://img.shields.io/badge/Next.js-16.3.0-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb?logo=react)](https://react.dev/)
[![Prisma ORM 7](https://img.shields.io/badge/Prisma-7.9.1-2d3748?logo=prisma)](https://www.prisma.io/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%2016-3ecf8e?logo=supabase)](https://supabase.com/)
[![Vercel AI SDK](https://img.shields.io/badge/Vercel%20AI%20SDK-Multiagent-000000?logo=vercel)](https://sdk.vercel.ai/)
[![License](https://img.shields.io/badge/License-Proprietary-660099.svg)](LICENSE)

> **CyberITSM SPN** é uma plataforma corporativa de *IT Service Management* (ITSM) voltada à Cibersegurança, Governança de Identidades (IAM/IGA), Gestão Hierárquica de Demandas (Jira/Trello), Esteira DevSecOps Multiagente e Auditoria Autônoma de Conformidade sobre a Matriz dos 314 Requisitos Segura SD v4.1.

---

## 🇧🇷 Documentação em Português

### 🌐 Visão Geral da Arquitetura (C4 Nível 2)

A arquitetura do sistema foi projetada no padrão de alta disponibilidade e resiliência sem ponto único de falha (*Zero Downtime*), combinando execução Serverless Edge na Vercel com banco PostgreSQL no Supabase, inteligência multiagente e barramento SCIM v2.0 / SAML 2.0.

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
- **Visualização & Dashboard Analytics**:
  - Badges coloridos por tipo (Épico: Roxo, Atividade: Azul, Tarefa: Verde) e tag com título do Épico Pai.
  - **Alerta Visual de Drag-and-Drop**: Bloqueio imediato com aviso amigável ao tentar arrastar card para coluna cujo fluxo de status seja inválido.
  - **Calculadora de Criticidade Interativa**: Avalia o impacto técnico do ticket cruzando `Prioridade * Framework * SLA`.

#### 2. 🛡️ Centro de Security QA & Dashboard SecOps
- **Engine de Análise Autônoma (`/api/qa-engine`)**: Ingestão de relatórios de varredura bruta e anexos documentais (JSON, XML, TXT, DOCX, PDF, JPG, PNG). O motor aplica OCR e parsing avançado, cruzando cada evidência com o escopo de requisitos de arquitetura e devolvendo um laudo de conformidade %.
- **Security QA Analytics Dashboard**:
  - **Volumetria de Vereditos**: Gráficos Recharts detalhando o acumulado de itens `Conforme`, `Parcial` e `Não Conforme`.
  - **Calculadora SecOps de Impacto**: Fórmula dinâmica `Severidade Vulnerabilidade * Escopo do Sistema * Exposição de Rede` com badges interativos de risco.
- **Cold Storage GZIP & Expurgo**: Comprime os artefatos anexados (até 10MB) e relatórios em GZIP (.gz), salvando no Supabase Storage (`qa-logs-archive`) para máximo aproveitamento do espaço físico e realizando o expurgo da evidência descomprimida temporária (Zero Data Leak).
- **Relatórios Executivos em PDF**: Exportação integral de relatórios de auditoria, projetos avaliados e laudos estruturados em PDF compilados nativamente via `@react-pdf/renderer`.

#### 3. 🤖 Copiloto de IA Multiagente (Zero Downtime)
Esteira de resiliência encadeada em **4 Camadas** com suporte a RAG sobre os 314 Requisitos. O Copiloto opera com uma persona **Especialista Sênior Estrita em Cibersegurança** e possui higiene automática do contexto a cada novo login (limpeza local).
1. **Camada 1 — Groq Engine (`GROQ_API_KEY`)**: Resposta ultra-rápida (< 2s) utilizando `llama-3.3-70b-versatile` com validação de esquema estrito em Zod.
2. **Camada 2 — OpenRouter Free (`OPENROUTER_API_KEY`)**: Roteamento secundário para modelos abertos gratuitos (`gemini-2.0-flash-lite-preview:free`, `nvidia/llama-3.1-nemotron-70b:free`).
3. **Camada 3 — Google Gemini (`GEMINI_API_KEY`)**: Modelos `gemini-2.0-flash` e `gemini-2.0-flash-lite` para janelas longas de contexto.
4. **Camada 4 — Motor Determinístico de Fallback**: Caso todas as APIs externas atinjam limites de cota (HTTP 429), o sistema executa um motor local por regras de expressão, garantindo que o usuário nunca receba tela branca ou erro 500.

#### 4. 🔑 Portal IAM / IGA & SCIM v2.0 / SAML 2.0
- **Provisionamento SCIM v2.0 (`/api/scim/v2/Users`)**: Endpoint completo para integração com Azure Entra ID, Okta e Keycloak para ciclo de vida de usuários.
- **SAML 2.0 SSO (`/api/saml/sso` & `/api/saml/metadata`)**: Suporte a Single Sign-On federado corporativo.
- **Fila Sailpoint JIT (Just-In-Time)**: Solicitação e aprovação de acessos com segregação de funções (SoD) e controle RBAC (`admin`, `analista`, `solicitante`).

#### 5. 📚 Base de Conhecimento SD v4.1 (314 Requisitos)
- Catálogo interativo navegável dos **314 Requisitos de Segurança de Desenvolvimento**.
- Filtros por criticidade (Crítico, Alto, Médio, Baixo) e busca instantânea.
- Mapeamento explícito de cada item com os frameworks: **NIST CSF**, **CIS Controls**, **OWASP Top 10**, **ISO 27001** e vetores de ameaça **STRIDE LM**.

#### 6. 🔌 Conectores Outbound, MTLS & Logs de Auditoria CSV
- **Conectores Nativos B2B**: Interfaces dedicadas para integração externa com **Jira Software**, **ServiceNow** e **Microsoft 365**.
- **Segurança MTLS (Mutual TLS)**: Suporte para exigência de certificados de cliente (Client Certificate `.pem/.crt` e Private Key `.key`) para conexões outbound seguras com outros ambientes.
- **Auditoria Transacional e Exportação CSV**: Rastreabilidade imutável de eventos operacionais e transacionais (HTTP, IPs, Métodos API) com função front-end de geração instantânea e download de relatório estruturado em formato CSV.

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

The architecture is designed for high availability and zero single points of failure (*Zero Downtime*). It combines Serverless Edge execution on Vercel with PostgreSQL database on Supabase, multiagent LLM resiliency, and a SCIM v2.0 / SAML 2.0 governance bus.

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
- **Visuals & Analytics**:
  - Color badges per type (Epic: Purple, Activity: Blue, Task: Green) and Parent Epic tag.
  - **Drag-and-Drop Visual Alert**: Instant block and friendly warning banner if dragging to an invalid status transition column.
  - **Interactive Criticality Calculator**: Technical impact evaluation using `Priority * Framework * SLA Window`.

#### 2. 🛡️ Security QA Center & SecOps Dashboard
- **Autonomous QA Engine (`/api/qa-engine`)**: Ingests raw scan logs and document attachments (JSON, XML, TXT, DOCX, PDF, JPG, PNG). The engine applies OCR and advanced parsing, cross-referencing evidence line-by-line against security requirements and outputs a compliance % audit report.
- **Security QA Analytics Dashboard**:
  - **Verdicts Volume**: Recharts graphics detailing `Conforming`, `Partial`, and `Non-Conforming` counts.
  - **SecOps Risk Calculator**: Dynamic formula `Vulnerability Severity * System Scope * Network Exposure` with interactive badges.
- **GZIP Cold Storage & Purge**: Compresses attached artifacts (up to 10MB) and raw evidence into GZIP (.gz), storing them in Supabase Storage (`qa-logs-archive`), and purging temporary uncompressed files (Zero Data Leak).
- **PDF Executive Reports**: Full export of audit reports, evaluated projects, and structured PDF reports natively compiled via `@react-pdf/renderer`.

#### 3. 🤖 Multiagent AI Copilot (Zero Downtime)
A **4-Tier Resiliency Pipeline** featuring RAG capabilities over the 314 security requirements. The Copilot operates with a **Strict Senior Cybersecurity Expert** persona and features automatic context hygiene on every new login (local memory wipe).
1. **Tier 1 — Groq Engine (`GROQ_API_KEY`)**: Ultra-fast response (< 2s) utilizing `llama-3.3-70b-versatile` with Zod structured output validation.
2. **Tier 2 — OpenRouter Free (`OPENROUTER_API_KEY`)**: Secondary routing to free open-weight models (`gemini-2.0-flash-lite-preview:free`, `nvidia/llama-3.1-nemotron-70b:free`).
3. **Tier 3 — Google Gemini (`GEMINI_API_KEY`)**: `gemini-2.0-flash` and `gemini-2.0-flash-lite` models for extensive context windows.
4. **Tier 4 — Deterministic Fallback Engine**: If all external AI providers hit quota limits (HTTP 429), the local token-matching engine executes, ensuring zero crashes or 500 errors.

#### 4. 🔑 IAM / IGA Portal & SCIM v2.0 / SAML 2.0
- **SCIM v2.0 Provisioning (`/api/scim/v2/Users`)**: Full RFC-compliant endpoint for Entra ID, Okta, and Keycloak user lifecycle automation.
- **SAML 2.0 SSO (`/api/saml/sso` & `/api/saml/metadata`)**: Enterprise federated Single Sign-On support.
- **Sailpoint JIT Queue**: Access request and approval workflows with Segregation of Duties (SoD) and RBAC (`admin`, `analista`, `solicitante`).

#### 5. 📚 SD v4.1 Knowledge Base (314 Requirements)
- Interactive searchable catalog of **314 Secure Development Requirements**.
- Filter by criticality (Critical, High, Medium, Low) and keyword search.
- Explicit mapping to industry frameworks: **NIST CSF**, **CIS Controls**, **OWASP Top 10**, **ISO 27001**, and **STRIDE LM** threat vectors.

#### 6. 🔌 Outbound Connectors, MTLS & CSV Audit Logs
- **B2B Native Connectors**: Dedicated interfaces for external integration with **Jira Software**, **ServiceNow**, and **Microsoft 365**.
- **MTLS Security (Mutual TLS)**: Support for client certificate requirement (Client Certificate `.pem/.crt` and Private Key `.key`) for secure outbound connections with other environments.
- **Transactional Audit and CSV Export**: Immutable traceability of operational and transactional events (HTTP, APIs, IPs) with front-end function for instant generation and download of structured reports in CSV format.

---

### 💻 Stack Tecnológica / Tech Stack

- **Framework Core**: Next.js 16.3 (App Router, Turbopack) & React 19
- **ORM / Database**: Prisma ORM 7.9 with `SqlDriverAdapter` + Supabase PostgreSQL 16
- **AI Infrastructure**: Vercel AI SDK 3.3, Groq, OpenRouter, Google Gemini, Zod Schemas
- **UI & Styling**: Tailwind CSS v4, Recharts, Lucide Icons, Radix UI
- **Storage & PDF**: Supabase Storage (`qa-logs-archive`), `@react-pdf/renderer`

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