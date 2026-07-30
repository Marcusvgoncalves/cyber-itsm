# CyberITSM 🛡️

**CyberITSM** is an IT Service Management (ITSM) system specialized in **Cybersecurity Architecture**. The project combines the agile visual UX of **Jira** (Kanban boards, list views, side panels for ticket details) with the safety controls and audits required by security governance and compliance standards.

*Português:* O **CyberITSM** é um sistema de Gerenciamento de Serviços de TI (ITSM) especializado em **Arquitetura de Cibersegurança**. O projeto combina a experiência visual do **Jira** com a rigidez e os controles exigidos por auditorias de segurança e conformidade.

---

## 🌍 Language Options / Opções de Idioma

- [🇧🇷 Documentação em Português](#-português)
- [🇺🇸 Documentation in English](#-english)

---

## 🇧🇷 Português

### 🚀 Tecnologias Utilizadas
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router) + TypeScript
- **Estilização & UI**: [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Backend as a Service (BaaS)**: [Supabase](https://supabase.com/) (PostgreSQL, Auth com MFA, RLS, Storage)
- **Deploy**: Vercel (Frontend) & Supabase (Database)

### 🔒 Alinhamento com Frameworks de Cibersegurança
O CyberITSM categoriza e gerencia os chamados com base em:
1. **NIST CSF**: Identify, Protect, Detect, Respond, Recover.
2. **CIS Controls**: Mapeamento direto de ações de controle (ex: CIS Control 1).
3. **ISO/IEC 27001**: Controles do Anexo A (ex: A.8, A.12).
4. **SABSA**: Camadas de arquitetura (Business, Conceptual, Logical, Physical, Component, Operational).

### 🛡️ Segurança e OWASP Top 10
- **Row Level Security (RLS)**: Tabelas protegidas diretamente no PostgreSQL.
- **MFA (Multi-Factor Authentication)**: Autenticação multifator nativa (TOTP).
- **Audit Log**: Histórico imutável de alterações em chamados gerado por trigger no banco.
- **Next.js 16 Proxy**: Tratamento de sessão em tempo de execução via `src/proxy.ts`.

### 📂 Estrutura de Pastas do Projeto
```text
cyber-itsm/
├── src/
│   ├── app/                 # Rotas, layouts e páginas (Next.js App Router)
│   │   ├── auth/callback    # Permite confirmação de login por email/OAuth
│   │   ├── login            # Tela de Login e Registro com RBAC
│   │   ├── mfa              # Ativação de MFA com QR Code (TOTP)
│   │   ├── globals.css      # Estilos globais (Tailwind CSS v4)
│   │   └── page.tsx         # Dashboard inicial / Landing Page
│   ├── components/          # Componentes reutilizáveis (shadcn/ui)
│   ├── lib/                 # Utilitários e instâncias (auth-context, supabase)
│   └── proxy.ts             # Interceptador e middleware de sessões (Next.js 16)
├── supabase_schema.sql      # Schema SQL completo e políticas RLS
└── package.json             # Dependências e scripts npm
```

### 📋 Progresso do Desenvolvimento

- [x] **FASE 1: Setup e Infraestrutura** — Criação do projeto Next.js, Tailwind v4 e shadcn/ui.
- [x] **FASE 2: Autenticação e Banco** — Configuração do Supabase (schema SQL de profiles, tickets, comments, audit_logs), RLS baseada em RBAC (admin, analyst, requester), fluxos de Login e MFA (TOTP).
- `[x]` **FASE 3: Core do ITSM (Estilo Jira)** — Dashboard principal, Kanban, formulário de abertura mapeando frameworks e geração de chaves `SEC-XXXX`.
- [ ] **FASE 4: Colaboração e Anexos** — Comentários nos chamados, histórico de auditoria visível e uploads no Supabase Storage.
- [ ] **FASE 5: Base de Conhecimento e APIs** — Base de artigos técnicos (KB) e API routes para integrações externas.
- [ ] **FASE 6: Revisão de Segurança e Deploy** — npm audit no CI/CD, Headers de segurança e deploy.

### ⚙️ Execução Local
1. Instale as dependências: `npm install`
2. Copie o `.env.local.example` para `.env.local` e configure suas chaves do Supabase.
3. Execute o servidor de desenvolvimento: `npm run dev`

---

## 🇺🇸 English

### 🚀 Tech Stack
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router) + TypeScript
- **Styling & UI**: [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Backend as a Service (BaaS)**: [Supabase](https://supabase.com/) (PostgreSQL, Auth with MFA, RLS, Storage)
- **Deployment**: Vercel (Frontend) & Supabase (Database)

### 🔒 Cybersecurity Framework Alignment
Tickets are categorized and managed based on:
1. **NIST CSF**: Identify, Protect, Detect, Respond, Recover.
2. **CIS Controls**: Mapping of control actions (e.g. CIS Control 1).
3. **ISO/IEC 27001**: Annex A controls (e.g. A.8, A.12).
4. **SABSA**: Architectural layers (Business, Conceptual, Logical, Physical, Component, Operational).

### 🛡️ Security and OWASP Top 10
- **Row Level Security (RLS)**: Tables secured at the database level inside PostgreSQL.
- **MFA (Multi-Factor Authentication)**: Native TOTP multifactor authentication support.
- **Audit Log**: Immutable audit logs on ticket changes powered by PostgreSQL triggers.
- **Next.js 16 Proxy**: Execution-time cookie session verification inside `src/proxy.ts`.

### 📂 Directory Structure
```text
cyber-itsm/
├── src/
│   ├── app/                 # Routes, layouts, and pages (Next.js App Router)
│   │   ├── auth/callback    # Handles email confirmation / OAuth code exchange
│   │   ├── login            # Login and Sign-up view with RBAC selector
│   │   ├── mfa              # MFA setup with QR Code (TOTP)
│   │   ├── globals.css      # Global stylesheet (Tailwind CSS v4)
│   │   └── page.tsx         # Dashboard landing page
│   ├── components/          # Shared components (shadcn/ui)
│   ├── lib/                 # Utilities and providers (auth-context, supabase client)
│   └── proxy.ts             # Session interceptor and router protection (Next.js 16)
├── supabase_schema.sql      # Database schemas and RLS policies
└── package.json             # Dependencies and scripts npm
```

### 📋 Roadmap Progress

- [x] **PHASE 1: Setup and Infrastructure** — Next.js project bootstrap, Tailwind CSS v4 setup, and shadcn/ui.
- [x] **PHASE 2: Authentication and Database** — Supabase configuration (SQL schema for profiles, tickets, comments, audit_logs), RBAC and RLS policies (admin, analyst, requester roles), Login and MFA (TOTP) workflows.
- `[x]` **PHASE 3: Core ITSM (Jira-style)** — Main dashboard, Kanban board, framework-integrated ticket creation form, and auto-generated keys (`SEC-XXXX`).
- [ ] **PHASE 4: Collaboration and Attachments** — Comment section, visible audit logs, and uploads into Supabase Storage.
- [ ] **PHASE 5: Knowledge Base & APIs** — Security articles database (KB) and API routes prepared for webhooks.
- [ ] **PHASE 6: Security Audit & Deployment** — CI dependency scans, security headers configuration, and final deploy.

### ⚙️ How to Run Locally
1. Install dependencies: `npm install`
2. Copy `.env.local.example` to `.env.local` and define your Supabase credentials.
3. Start the dev server: `npm run dev`
