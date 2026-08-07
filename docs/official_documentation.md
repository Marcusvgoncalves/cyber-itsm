# Especificação Técnica Oficial — CyberITSM SPN

## 1. Visão Geral da Arquitetura & Diretrizes de Projeto

O **CyberITSM SPN** é uma plataforma corporativa especializada em **IT Service Management (ITSM)** para **Cibersegurança e Governança de TI**. Projetado sobre Next.js 16 (App Router), React 19, Supabase PostgreSQL 16 e Prisma ORM v7, o sistema oferece:
- Gestão de chamados operacionais via **Quadro Kanban & Dashboard de Volumetria**.
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
|  /dashboard (Kanban + Analytics)           /security-qa (Engine + Dashboard QA)  |
|  /knowledge-base (314 Requisitos)          /login & /reset-password (MFA TOTP)   |
+-----------------------------------------------------------------------------------+
                                          |
                                Server Actions / REST API
                                          v
+-----------------------------------------------------------------------------------+
|            CAMADA BACKEND — Edge Proxy, Middleware & Esteira Multiagente IA       |
|  proxy.ts (Rate Limit Interceptor)          /api/qa-engine (Zod + Stream)         |
|  /api/scim/v2/Users (SCIM v2.0)             /api/saml/sso (SAML 2.0 Metadata)     |
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

### 3.1 Módulo Kanban & Dashboard Analytics
- **Localização**: `components/kanban/kanban-board.tsx` & `components/kanban/kanban-dashboard.tsx`
- **Capacidades**:
  - Drag-and-drop de chamados entre colunas de status.
  - Indicadores volumétricos de backlog ativo e taxa de conformidade SLA.
  - Calculadora de criticidade dinâmica: `Score = Prioridade * Framework (NIST, CIS, PCI-DSS, SABSA, LGPD) * Janela SLA`.
  - Previsão preditiva de demandas semanais e tempo estimado de apuração da fila.

### 3.2 Centro de Security QA & Dashboard SecOps
- **Localização**: `app/(app)/security-qa/` & `components/security-qa/`
- **Capacidades**:
  - Ingestão de relatórios brutos de vulnerabilidade (.json, .xml, .txt).
  - Cruzamento automático dos achados com os requisitos de arquitetura via Zod e IA.
  - Security QA Analytics Dashboard com vereditos (`conforme`, `parcial`, `nao_conforme`) e calculadora SecOps: `Score = Severidade * Escopo do Sistema * Exposição de Rede`.
  - Cold Storage em GZIP (.gz) no bucket `qa-logs-archive` e expurgo automático da evidência bruta descomprimida (Zero Data Leak).
  - Emissão de relatórios executivos em PDF compilados via `@react-pdf/renderer`.

### 3.3 Copiloto de IA Multiagente (Zero Downtime)
- **Localização**: `app/api/chat/route.ts` & `app/api/qa-engine/route.ts`
- **Capacidades**:
  - Roteamento transparente em cascata entre Groq, OpenRouter, Google Gemini e Motor Determinístico.
  - Esquema estrito Zod para estruturação JSON de resposta.
  - RAG (*Retrieval-Augmented Generation*) integrado consultando o acervo dos 314 Requisitos Segura SD v4.1.

### 3.4 Portal IAM / IGA & Conectores SCIM v2.0 / SAML 2.0
- **Localização**: `app/api/scim/v2/Users/route.ts`, `app/api/saml/sso/route.ts`, `app/actions/iam.ts`
- **Capacidades**:
  - Protocolo SCIM v2.0 para criação, leitura, atualização e inativação de identidades por Provedores de Identidade (IdP).
  - SAML 2.0 Single Sign-On federado com suporte a metadados XML.
  - Gestão de solicitações Just-In-Time (JIT) via Sailpoint com papel RBAC e justificativa SecOps.

---

## 4. Estrutura do Banco de Dados (Prisma Schema v7)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
  output   = "../lib/generated/prisma"
}

model Ticket {
  id               String   @id @default(uuid())
  title            String
  description      String
  status           String   @default("aberto")
  priority         String   @default("media")
  frameworkOrigem String?  @map("framework_origem")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  @@map("tickets")
}

model QaProject {
  id             String     @id @default(uuid())
  name           String
  environmentUrl String     @map("environment_url")
  requirements   String
  createdBy      String?    @map("created_by")
  createdAt      DateTime   @default(now()) @map("created_at")
  results        QaResult[]

  @@map("qa_projects")
}

model QaResult {
  id                 String    @id @default(uuid())
  projectId          String    @map("project_id")
  project            QaProject @relation(fields: [projectId], references: [id], onDelete: Cascade)
  originalFileName   String    @map("original_file_name")
  tempStoragePath    String?   @map("temp_storage_path")
  archivedFilePath   String    @map("archived_file_path")
  archivedFileUrl    String?   @map("archived_file_url")
  archivedSizeBytes  BigInt    @map("archived_size_bytes")
  originalSizeBytes  BigInt    @map("original_size_bytes")
  compressionRatio   Float?    @map("compression_ratio")
  compliancePercent  Float     @map("compliance_percent")
  overallRating      String    @map("overall_rating")
  executiveSummary   String    @map("executive_summary")
  findings           Json
  status             String    @default("concluido")
  errorMessage       String?   @map("error_message")
  createdAt          DateTime  @default(now()) @map("created_at")

  @@map("qa_results")
}
```

---

## 5. English Architecture & Specification Summary

The **CyberITSM SPN** platform is built on Next.js 16, React 19, Supabase PostgreSQL, and Prisma ORM v7. It features:
- **Kanban Board & Volumetric Analytics**: Dynamic ticket pipeline management with SLA forecasting and criticality score calculators.
- **Security QA Center**: Automated vulnerability report evaluation against the **314 SD v4.1 Requirements**, GZIP cold storage archiving, Zero Data Leak purge, and native PDF generation.
- **4-Tier Multiagent AI Pipeline**: Seamless fallback routing (Groq Llama 3.3 70B -> OpenRouter Free LLMs -> Google Gemini 2.0 -> Deterministic Rules Engine) with RAG over security requirements.
- **IAM / IGA Portal**: SCIM v2.0 provisioning endpoints (`/api/scim/v2/Users`), SAML 2.0 federated SSO, and Sailpoint JIT access request approval workflows.
- **Reactive Session & Security**: MFA/TOTP (RFC 6238) enforcement, 1-hour active session limit, 15-minute idle timeout, and per-user local chat history persistence.