# CyberITSM SPN — Plataforma Corporativa de Cibersegurança & Governança

[![Next.js 16](https://img.shields.io/badge/Next.js-16.3.0-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb?logo=react)](https://react.dev/)
[![Prisma ORM 7](https://img.shields.io/badge/Prisma-7.9.1-2d3748?logo=prisma)](https://www.prisma.io/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%2016-3ecf8e?logo=supabase)](https://supabase.com/)
[![Vercel AI SDK](https://img.shields.io/badge/Vercel%20AI%20SDK-Multiagent-000000?logo=vercel)](https://sdk.vercel.ai/)
[![License](https://img.shields.io/badge/License-Proprietary-660099.svg)](LICENSE)

> **CyberITSM SPN** é uma plataforma corporativa de *IT Service Management* (ITSM) voltada à Cibersegurança, Governança de Identidades (IAM/IGA), Esteira DevSecOps Multiagente e Auditoria Autônoma de Conformidade sobre a Matriz dos 314 Requisitos Segura SD v4.1.

---

## 🇧🇷 Documentação em Português

### 🌐 Visão Geral da Arquitetura (C4 Nível 2)

A arquitetura do sistema foi projetada no padrão de alta disponibilidade e resiliência sem ponto único de falha (*Zero Downtime*), combinando execução Serverless Edge na Vercel com banco PostgreSQL no Supabase, inteligência multiagente e barramento SCIM v2.0 / SAML 2.0.

![Desenho de Arquitetura CyberITSM SPN](public/images/architecture.svg)

---

### 🚀 Módulos e Funcionalidades Principais

#### 1. 📋 Quadro Kanban & Dashboard de Volumetria
- **Gestão Visão de Fluxo**: Movimentação visual de chamados por colunas de status (Aberto, Em Andamento, Revisão, Fechado, Cancelado).
- **Kanban Analytics Dashboard**:
  - **Métricas Volumétricas**: Total de backlog ativo, cumprimentos de SLA e distribuição de prioridades.
  - **Calculadora de Criticidade Interativa**: Avalia o impacto técnico do ticket cruzando `Prioridade * Framework de Origem (NIST, CIS, PCI-DSS, SABSA, LGPD) * Janela de SLA`.
  - **Previsão de Demanda e Atendimento**: Estimativas automáticas de dias para esvaziar a fila e projeção de novos chamados.

#### 2. 🛡️ Centro de Security QA & Dashboard SecOps
- **Engine de Análise Autônoma (`/api/qa-engine`)**: Ingestão de relatórios de varredura bruta (JSON, XML, TXT). O motor cruza cada evidência com o escopo de requisitos de arquitetura e devolva um laudo de conformidade %.
- **Security QA Analytics Dashboard**:
  - **Volumetria de Vereditos**: Gráficos Recharts detalhando o acumulado de itens `Conforme`, `Parcial` e `Não Conforme`.
  - **Calculadora SecOps de Impacto**: Fórmula dinâmica `Severidade Vulnerabilidade * Escopo do Sistema * Exposição de Rede` com badges interativos de risco.
- **Cold Storage GZIP & Expurgo**: Comprime o artefato original em GZIP (.gz), salva no Supabase Storage (`qa-logs-archive`) e realiza o expurgo da evidência descomprimida temporária (Zero Data Leak).
- **Relatórios Executivos em PDF**: Exportação de relatórios estruturados e download do manual da plataforma em PDF compilado nativamente via `@react-pdf/renderer`.

#### 3. 🤖 Copiloto de IA Multiagente (Zero Downtime)
Esteira de resiliência encadeada em **4 Camadas** com suporte a RAG sobre os 314 Requisitos:
1. **Camada 1 — Groq Engine (`GROQ_API_KEY`)**: Resposta ultra-rápida (&lt; 2s) utilizando `llama-3.3-70b-versatile` com validação de esquema estrito em Zod.
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

---

### 🚀 Key Modules and Features

#### 1. 📋 Kanban Board & Volumetric Dashboard
- **Visual Workflow Management**: Drag-and-drop ticket state transitions (Open, In Progress, Review, Closed, Canceled).
- **Kanban Analytics Dashboard**:
  - **Volumetric Metrics**: Active backlog count, SLA compliance rate, priority breakdown.
  - **Interactive Criticality Calculator**: Calculates ticket risk score using `Priority * Origin Framework (NIST, CIS, PCI-DSS, SABSA, LGPD) * SLA Window`.
  - **Demand & Resolution Forecast**: Automated predictions for backlog clearance and new incoming tickets.

#### 2. 🛡️ Security QA Center & SecOps Dashboard
- **Autonomous QA Engine (`/api/qa-engine`)**: Ingests raw scan logs (JSON, XML, TXT). Cross-references evidence line-by-line against security requirements and outputs a compliance % audit report.
- **Security QA Analytics Dashboard**:
  - **Verdicts Volume**: Recharts graphics detailing `Conforming`, `Partial`, and `Non-Conforming` counts.
  - **SecOps Risk Calculator**: Dynamic formula `Vulnerability Severity * System Scope * Network Exposure` with interactive badges.
- **GZIP Cold Storage & Purge**: Compresses raw evidence into GZIP (.gz), stores it in Supabase Storage (`qa-logs-archive`), and purges temporary uncompressed raw logs (Zero Data Leak).
- **PDF Executive Reports**: Generates downloadable PDF audit reports and official user guide natively compiled via `@react-pdf/renderer`.

#### 3. 🤖 Multiagent AI Copilot (Zero Downtime)
A **4-Tier Resiliency Pipeline** featuring RAG capabilities over the 314 security requirements:
1. **Tier 1 — Groq Engine (`GROQ_API_KEY`)**: Ultra-fast response (&lt; 2s) utilizing `llama-3.3-70b-versatile` with Zod structured output validation.
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