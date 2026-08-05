# 🛡️ CyberITSM SPN

[🇧🇷 Português](#português) · [🇺🇸 English](#english)

---

## 🇧🇷 Português

**CyberITSM SPN** é uma plataforma corporativa de **IT Service Management (ITSM)** especializada em **Arquitetura de Cibersegurança e Conformidade Regulatória**. Ela entrega um quadro Kanban interativo para o controle de atividades de mitigação de vulnerabilidades, um **agente de IA generativa com RAG** sobre a base de requisitos Segura SD v4.1, e um **portal completo de governança de identidade (IAM/IGA)** com autenticação multi-fator (MFA) obrigatória.

Construída do zero com **Next.js 16 (App Router)** e **Supabase (BaaS)**, seguindo a identidade visual do design system **Mistica da Vivo Telefônica** (paleta roxa `#660099`, laranja Vivo `#FF9900` e tipografia Outfit).

### 🧭 Desenho de Arquitetura da Solução

![Arquitetura CyberITSM SPN](./public/images/architecture.svg)

O diagrama acima detalha **todos os contêineres, componentes, tabelas do banco, fluxos de autenticação/MFA, pipeline RAG de IA e integrações IAM/IGA** da solução.

### 🚀 Tecnologias Adotadas

| Camada | Tecnologia | Descrição |
| :--- | :--- | :--- |
| **Frontend** | React 19 · Next.js 16 App Router · Tailwind CSS v4 | SPA com tema Mistica. |
| **UI Assets** | Radix UI · Lucide Icons · CVA · clsx/tailwind-merge | Componentes acessíveis e primitivas de UI. |
| **Backend** | Next.js Server Actions · Route Handlers · `proxy.ts` | Lógica serverless na Vercel, proteção de rotas e RBAC/MFA. |
| **IA Generativa** | Vercel AI SDK v7 · `@ai-sdk/google` (`gemini-flash-latest`) | Agente SecOps com RAG sobre 314 requisitos. `streamText`, temperatura 0.2. |
| **RAG / Conhecimento** | `requisitos-sd.json` | Recuperação por keywords com pesos (core×3, detail×2, light×1). |
| **Banco de Dados** | Supabase PostgreSQL 15 | 8 tabelas com Row Level Security (RLS) ativa, triggers e seeds. |
| **Autenticação & MFA** | Supabase Auth · TOTP RFC 6238 (HMAC-SHA1) | Sessão por cookies, MFA/TOTP obrigatório com onboarding por QR Code. |
| **IAM / IGA** | Adaptadores simulados (Entra ID, Keycloak, OAM, Sailpoint) + criação local | Governança de identidade, fila de aprovação e gestão de usuários. |
| **Deploy** | Vercel | CDN/Edge serverless; pronto para produção online. |

---

### 🗂️ Estrutura do Projeto

```
cyber-itsm/
├── app/                          # Rotas (App Router)
│   ├── page.tsx                  # Redireciona para /dashboard ou /login
│   ├── layout.tsx                # Layout raiz (fontes, metadados)
│   ├── globals.css               # Estilos globais Mistica
│   ├── actions/                  # Server Actions (tipadas, "use server")
│   │   ├── auth.ts               #   Login, MFA, reset de senha, auditoria
│   │   ├── iam.ts                #   IAM/IGA + gestão de usuários (createLocalUser etc.)
│   │   └── tickets.ts            #   CRUD de tickets, status e comentários
│   ├── api/chat/route.ts         # Endpoint RAG da IA (streamText + Gemini)
│   ├── dashboard/                # Página principal (Kanban + IAM + Audit + C4 + Config)
│   ├── login/page.tsx            # Página de autenticação
│   └── reset-password/page.tsx   # Redefinição de senha
├── components/
│   ├── kanban/                   # KanbanBoard, KanbanCard, KanbanColumn, ticket-modal
│   ├── SecurityAgent.tsx         # Agente de IA (FAB) via useChat/@ai-sdk/react
│   ├── login-form.tsx            # Fluxo de login com 3 passos (credenciais, MFA onboarding, MFA verify)
│   ├── architecture-diagram.tsx  # Mapa de arquitetura interativo (cliente)
│   └── ui/                       # button, card, input, label, select, separator, textarea
├── lib/
│   ├── totp.ts                   # Geração/validação TOTP (RFC 6238, Web Crypto)
│   ├── supabase.ts               # Acesso a dados (getTickets, getUsers, CRUD, auditoria)
│   ├── types.ts                  # Modelos tipados + permissões RBAC
│   └── utils.ts                  # cn() — combina classes
├── utils/supabase/
│   ├── server.ts                 # Client SSR (cookies de sessão)
│   ├── client.ts                 # Client browser
│   └── admin.ts                  # Client service role (operação de admin)
├── proxy.ts                      # Middleware Next.js 16: sessão + RBAC + check MFA
├── supabase-schema.sql           # Schema completo (tabelas, RLS, triggers, seeds)
├── requisitos-sd.json            # Base de conhecimento RAG (314 requisitos)
└── public/images/architecture.svg # Desenho de arquitetura da solução
```

---

### 🔒 Jornada de Segurança & Políticas

1. **Modelo de Login por Nome de Usuário** — O formulário de login foi simplificado para aceitar o formato corporativo `nome.sobrenome` (sem formatação ou validação de e-mail na interface).
2. **Complexidade de senhas obrigatória** — mín. 12 caracteres com maiúsculas, minúsculas, números e símbolos. Ex.: `CyberITSM@2026!Password`.
3. **Sessão segura** — Supabase Auth com cookies; `proxy.ts` (substitui o `middleware.ts` no Next.js 16) garante autenticação antes do `/dashboard`.
4. **MFA obrigatório para todas as contas** — fluxo no `login-form.tsx`:
   - **Sem MFA configurado** → onboarding: gera secret + QR Code, valida o código de 6 dígitos (`confirmMfaSetup`) e grava o cookie `mfa_verified`.
   - **Com MFA configurado** → verificação de código (`verifyMfa`) na janela temporária ±1 intervalo.
   - O `proxy.ts` bloqueia acesso ao dashboard sem o cookie — ninguém acessa sem 2º fator.
   - Código de homologação (sandbox): `123456`.
5. **RBAC** — perfis `admin`, `analista`, `solicitante`. Rotas administrativas (Audit Logs, Arquitetura) bloqueadas para não-admins.
6. **Auditoria** — todo evento relevante gravado em `audit_logs` (login, MFA, criação de chamados, sincronizações IAM, alterações de perfil).

### 🧠 Agente de IA SecOps (RAG)

- Endpoint: `app/api/chat/route.ts`.
- Modelo: Google **Gemini** via `@ai-sdk/google` — `gemini-flash-latest` (um fallback local Ollama fica comentado/desabilitado).
- Conhecimento: `requisitos-sd.json` — **314 requisitos** de Arquitetura Segura SD v4.1 (id `VIVO.SEGURA.*`, controle, componente, propriedade, STRIDE/LM, OWASP, categoria, criticidade, evidência, como testar).
- Recuperação: tokenização com normalização NFD, remoção de stopwords e pontuação, pontuação ponderada por campo.
- Injeção de contexto no prompt: `[CONTEXTO DO CHAMADO]` + `[BASE DE CONHECIMENTO - REQUISITOS RELEVANTES]`; sanitização anti-prompt-injection (`sanitizeText`).
- Diretrizes do system prompt: respostas assertivas, completas e exaustivas, em bullets curtos, citando o ID e os campos do requisito, ou `'Informação não encontrada no contexto atual.'`.
- UI: `components/SecurityAgent.tsx` (FAB) via `useChat` do `@ai-sdk/react` com `DefaultChatTransport`, enviando `ticketContext`.

### 📚 Base de Conhecimento de Segurança

- **Aba de Consulta Didática** — Nova página integrada no painel, visível a todos os usuários, agregando:
  - **Matriz Interativa**: Tabela completa com os 314 controles de arquitetura segura. Oferece filtragem dinâmica em tempo real (busca textual rápida por ID, componente, riscos ou categorias) e visualização expansível de cada controle (detalhamento técnico, riscos, validação/teste e evidência).
  - **Enciclopédia de Frameworks**: Explicação didática de frameworks corporativos como **NIST CSF**, **CIS Controls**, **OWASP Top 10**, **STRIDE Threat Modeling**, **ISO 27001 & SABSA** e **LGPD**.

### ✉️ Serviço de E-mail Transacional (Resend)

- **Notificações Automáticas**: Envio de e-mails transacionais assíncronos (fire-and-forget) após a criação ou edição de chamados no Kanban.
- **Modos de Operação**:
  - **Sandbox**: Modo de teste em que o remetente é fixo (`onboarding@resend.dev`) e o destinatário é forçado para o e-mail de teste verificado (`TEST_EMAIL_RECIPIENT`), prevenindo spans em homologação.
  - **Production**: Envio para os envolvidos utilizando o domínio próprio e remetente verificado (`EMAIL_FROM`).

### 🆔 Portal de Governança de Identidades (IAM / IGA)

- **Provedores simulados**: Microsoft Entra ID (OIDC), Keycloak Broker, Oracle Access Manager (OAM), Sailpoint IdentityNow (IGA).
- **Sincronização** (`syncIamProvider`): importa usuários mock de Entra/Keycloak.
- **Fila de aprovação Sailpoint**: `createIdentityRequest` → `approveIdentityRequest`/`rejectIdentityRequest` → provisiona o perfil em `users_profiles`.
- **Criação manual de usuários** (`createLocalUser`): cria um usuário **real** em `auth.users` via **Admin API** (service role), define a senha padrão inicial como **`CyberITSM@2026!Password`**, força troca de senha e **MFA obrigatório** (`mfa_setup_complete = false`). O trigger `on_auth_user_created` cria o perfil.
- **Gestão de usuários (só admin)**: `listSystemUsers`, `updateUserRole` (RBAC), `setUserActive` (ban/reativação) e `forceMfaReconfiguration` (reset forçado do MFA). UI no card "Gestão de Usuários do Sistema" do dashboard.

### 🗃️ Banco de Dados (Supabase)

8 tabelas: `users_profiles`, `tickets`, `ticket_statuses`, `comments`, `audit_logs`, `iam_providers`, `iam_users`, `identity_requests`. Com RLS, triggers (`on_auth_user_created`, `handle_updated_at`, `handle_ticket_closed`) e funções de role (`is_admin`, `is_analista`, `is_admin_or_analista`). Schema completo em `supabase-schema.sql`.

---

### ⚙️ Execução Local

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Configure `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=seu_projeto_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=seu_projeto_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key        # para criação de usuários/gestão IAM
   GOOGLE_GENERATIVE_AI_API_KEY=sua_chave_gemini         # para a IA generativa
   ```
3. Banco de dados: execute o conteúdo de `supabase-schema.sql` no **SQL Editor** do Supabase (cria tabelas, RLS, triggers e seeds).
4. Inicie:
   ```bash
   npm run dev
   ```
5. Acesse `http://localhost:3000`.

> **Usuário admin inicial**: crie via SQL no SQL Editor, pois contas criadas pela UI já exigem MFA. Veja a seção "Provisionamento de Administrador".
>
> **Credenciais de teste**: `marcus.goncalves` ou `joao.secops` / `CyberITSM@2026!Password`.

### 👤 Provisionamento de Usuário Administrador & MFA

Crie o super admin (o trigger cria o perfil com a `role` vinda de `user_metadata.role`):
```sql
select auth.admin_create_user(
  email         => 'marcus.goncalves@cyberitsm.local',
  password      => 'SenhaForte@2026!x',
  email_confirm => true,
  user_metadata => '{"role":"admin","full_name":"Marcus Gonçalves"}'::jsonb
);
```
O primeiro acesso exigirá a configuração do MFA (2º fator).

### 🧪 Verificando o Código

```bash
npx tsc --noEmit
npm run build
npm run lint
```

---

### ☁️ Publicação na Vercel

O projeto está pronto para deploy na Vercel (funcionamento online).

1. **Aplique o schema** no SQL Editor do Supabase **antes** do deploy (tabelas, RLS, triggers, seeds).
2. **Conecte o repositório** ao painel da Vercel (deploy automático por push na `main`) ou rode `vercel --prod`.
3. Configure as **Environment Variables**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   GOOGLE_GENERATIVE_AI_API_KEY=
   ```
4. **Segurança**: a `SUPABASE_SERVICE_ROLE_KEY` opera somente no servidor (nunca exponha em código client). A criação de usuários e a gestão de IAM dependem dela.

> Detalhes técnicos completos (componentes, RLS, RAG, integrações) em [`docs/official_documentation.md`](docs/official_documentation.md).

### 🚦 Segurança no CI/CD (Deploy Gate)

Todo commit/PR na `main` dispara o pipeline de segurança [`Enterprise Security Scan`](.github/workflows/enterprise-security.yml), que **bloqueia o deploy na Vercel** se encontrar vulnerabilidades (segredos, CVEs High/Critical, falhas OWASP/SAST/DAST). Veja as regras customizadas de vazamento em [`.gitleaks.toml`](.gitleaks.toml) e o passo a passo de configuração do gate em [`docs/deploy-gate.md`](docs/deploy-gate.md).

---

## 🇺🇸 English

**CyberITSM SPN** is a corporate **IT Service Management (ITSM)** platform specialized in **Cybersecurity Architecture and Regulatory Compliance**. It delivers an interactive Kanban board for vulnerability remediation tracking, a **generative AI agent with RAG** over the Secure Architecture SD v4.1 requirements base, and a **complete identity governance portal (IAM/IGA)** with mandatory multi-factor authentication (MFA).

Built from scratch with **Next.js 16 (App Router)** and **Supabase (BaaS)**, following the **Vivo Telefónica Mistica** design system (purple `#660099`, Vivo orange `#FF9900`, Outfit typography).

### 🧭 Solution Architecture Diagram

![CyberITSM SPN Architecture](./public/images/architecture.svg)

The diagram details **every container, component, database table, authentication/MFA flow, AI RAG pipeline, and IAM/IGA integration** of the solution.

### 🚀 Technology Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19 · Next.js 16 App Router · Tailwind CSS v4 | SPA with Vivo Mistica theme. |
| **UI Assets** | Radix UI · Lucide Icons · CVA · clsx/tailwind-merge | Accessible components and UI primitives. |
| **Backend** | Next.js Server Actions · Route Handlers · `proxy.ts` | Serverless logic on Vercel, route protection and RBAC/MFA. |
| **Generative AI** | Vercel AI SDK v7 · `@ai-sdk/google` (`gemini-flash-latest`) | SecOps agent with RAG over 314 requirements. `streamText`, temperature 0.2. |
| **RAG / Knowledge** | `requisitos-sd.json` | Weighted keyword retrieval (core×3, detail×2, light×1). |
| **Database** | Supabase PostgreSQL 15 | 8 tables with Row Level Security (RLS), triggers and seeds. |
| **Auth & MFA** | Supabase Auth · TOTP RFC 6238 (HMAC-SHA1) | Cookie session, mandatory TOTP MFA with QR Code onboarding. |
| **IAM / IGA** | Simulated adapters (Entra ID, Keycloak, OAM, Sailpoint) + local creation | Identity governance, approval queue and user management. |
| **Deploy** | Vercel | CDN/Edge serverless; production-ready. |

---

### 🗂️ Project Structure

```
cyber-itsm/
├── app/                          # Routes (App Router)
│   ├── page.tsx                  # Redirects to /dashboard or /login
│   ├── layout.tsx                # Root layout (fonts, metadata)
│   ├── globals.css               # Mistica global styles
│   ├── actions/                  # Typed Server Actions ("use server")
│   │   ├── auth.ts               #   Login, MFA, password reset, audit
│   │   ├── iam.ts                #   IAM/IGA + user mgmt (createLocalUser etc.)
│   │   └── tickets.ts            #   Ticket/status/comment CRUD
│   ├── api/chat/route.ts         # AI RAG endpoint (streamText + Gemini)
│   ├── dashboard/                # Main page (Kanban + IAM + Audit + C4 + Config)
│   ├── login/page.tsx            # Authentication page
│   └── reset-password/page.tsx   # Password reset
├── components/
│   ├── kanban/                   # KanbanBoard, KanbanCard, KanbanColumn, ticket-modal
│   ├── SecurityAgent.tsx         # AI agent (FAB) via useChat/@ai-sdk/react
│   ├── login-form.tsx            # 3-step login (credentials, MFA onboarding, MFA verify)
│   ├── architecture-diagram.tsx  # Interactive architecture map (client)
│   └── ui/                       # button, card, input, label, select, separator, textarea
├── lib/
│   ├── totp.ts                   # TOTP generation/validation (RFC 6238, Web Crypto)
│   ├── supabase.ts               # Data access (getTickets, getUsers, CRUD, audit)
│   ├── types.ts                  # Typed models + RBAC permissions
│   └── utils.ts                  # cn() — class combiner
├── utils/supabase/
│   ├── server.ts                 # SSR client (session cookies)
│   ├── client.ts                 # Browser client
│   └── admin.ts                  # Service-role client (admin operations)
├── proxy.ts                      # Next.js 16 middleware: session + RBAC + MFA check
├── supabase-schema.sql           # Full schema (tables, RLS, triggers, seeds)
├── requisitos-sd.json            # RAG knowledge base (314 requirements)
└── public/images/architecture.svg # Solution architecture diagram
```

### 🔒 Security Journey & Policies

1. **Username Login Model** — The login form is simplified to accept the corporate `nome.sobrenome` pattern (without formatting or email validation on frontend input fields).
2. **Mandatory password strength** — min. 12 characters with uppercase, lowercase, numbers and symbols. E.g. `CyberITSM@2026!Password`.
3. **Secure session** — Supabase Auth with cookies; `proxy.ts` (replaces `middleware.ts` in Next.js 16) enforces authentication before `/dashboard`.
4. **MFA mandatory for all accounts** — flow in `login-form.tsx`:
   - **MFA not configured** → onboarding: generates secret + QR Code, validates the 6-digit code (`confirmMfaSetup`) and stores the `mfa_verified` cookie.
   - **MFA configured** → code verification (`verifyMfa`) within the ±1 interval window.
   - `proxy.ts` blocks dashboard access without the cookie — nobody enters without the second factor.
   - Sandbox test code: `123456`.
5. **RBAC** — roles `admin`, `analista`, `solicitante`. Admin routes (Audit Logs, Architecture) are blocked for non-admins.
6. **Auditing** — every relevant event is recorded in `audit_logs` (login, MFA, ticket creation, IAM sync, profile changes).

### 🧠 SecOps AI Agent (RAG)

- Endpoint: `app/api/chat/route.ts`.
- Model: Google **Gemini** via `@ai-sdk/google` — `gemini-flash-latest` (a local Ollama fallback is commented out/disabled).
- Knowledge: `requisitos-sd.json` — **314 requirements** of Secure Architecture SD v4.1 (id `VIVO.SEGURA.*`, control, component, property, STRIDE/LM, OWASP, category, criticality, evidence, how-to-test).
- Retrieval: tokenization with NFD normalization, stopword and punctuation removal, weighted field scoring.
- Prompt context injection: `[CONTEXTO DO CHAMADO]` + `[BASE DE CONHECIMENTO - REQUISITOS RELEVANTES]`; anti-prompt-injection sanitization (`sanitizeText`).
- System-prompt directives: assertive, complete and exhaustive answers in short bullets, citing the requirement ID and fields, or `'Informação não encontrada no contexto atual.'`.
- UI: `components/SecurityAgent.tsx` (FAB) via `useChat` from `@ai-sdk/react` with `DefaultChatTransport`, sending `ticketContext`.

### 📚 Security Knowledge Base

- **Didactic Search Tab** — Integrated view on the dashboard accessible to all users, combining:
  - **Interactive Matrix**: Table with all 314 secure architecture requirements. Offers dynamic real-time filtering (by ID, component, risks, or threat model categories) and an expandable view showing validation steps and expected evidence.
  - **Frameworks Encyclopedia**: Educational descriptions detailing the principles of **NIST CSF**, **CIS Controls**, **OWASP Top 10**, **STRIDE Threat Modeling**, **ISO 27001 & SABSA**, and **LGPD**.

### ✉️ Transactional Email Service (Resend)

- **Automatic Notifications**: Asynchronous (fire-and-forget) transactional emails sent on ticket creation or update.
- **Operational Modes**:
  - **Sandbox**: Testing mode where the sender is fixed (`onboarding@resend.dev`) and delivery is forced to the verified test email address (`TEST_EMAIL_RECIPIENT`) to prevent spamming unverified users.
  - **Production**: Live delivery utilizing custom verified domains (`EMAIL_FROM`).

### 🆔 Identity Governance Portal (IAM / IGA)

- **Simulated providers**: Microsoft Entra ID (OIDC), Keycloak Broker, Oracle Access Manager (OAM), Sailpoint IdentityNow (IGA).
- **Sync** (`syncIamProvider`): imports mock users from Entra/Keycloak.
- **Sailpoint approval queue**: `createIdentityRequest` → `approveIdentityRequest`/`rejectIdentityRequest` → provisions the role in `users_profiles`.
- **Manual user creation** (`createLocalUser`): creates a **real** user in `auth.users` via the **Admin API** (service role), defines the initial default password as **`CyberITSM@2026!Password`**, forces password changes, and **mandatory MFA** (`mfa_setup_complete = false`). The `on_auth_user_created` trigger creates the profile.
- **User management (admin only)**: `listSystemUsers`, `updateUserRole` (RBAC), `setUserActive` (ban/reactivation) and `forceMfaReconfiguration`. UI in the "Gestão de Usuários do Sistema" dashboard card.

### 🗃️ Database (Supabase)

8 tables: `users_profiles`, `tickets`, `ticket_statuses`, `comments`, `audit_logs`, `iam_providers`, `iam_users`, `identity_requests`. With RLS, triggers (`on_auth_user_created`, `handle_updated_at`, `handle_ticket_closed`) and role functions (`is_admin`, `is_analista`, `is_admin_or_analista`). Full schema in `supabase-schema.sql`.

---

### ⚙️ Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key      # for user creation/IAM management
   GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key          # for generative AI
   ```
3. Database: run the contents of `supabase-schema.sql` in the Supabase **SQL Editor** (creates tables, RLS, triggers and seeds).
4. Start:
   ```bash
   npm run dev
   ```
5. Visit `http://localhost:3000`.

> **Initial admin user**: create it via SQL in the SQL Editor, since accounts created through the UI already require MFA. See "Admin Provisioning".
>
> **Test credentials**: `marcus.goncalves` or `joao.secops` / `CyberITSM@2026!Password`.

### 👤 Admin & MFA Provisioning

Create the super admin (the trigger creates the profile with `role` from `user_metadata.role`):
```sql
select auth.admin_create_user(
  email         => 'marcus.goncalves@cyberitsm.local',
  password      => 'SenhaForte@2026!x',
  email_confirm => true,
  user_metadata => '{"role":"admin","full_name":"Marcus Gonçalves"}'::jsonb
);
```
The first login will require MFA setup.

### 🧪 Verifying the Code

```bash
npx tsc --noEmit
npm run build
npm run lint
```

---

### ☁️ Deploying on Vercel

The project is ready for Vercel deployment (online operation).

1. **Apply the schema** in the Supabase SQL Editor **before** deploying (tables, RLS, triggers, seeds).
2. **Connect the repository** to the Vercel dashboard (auto-deploy on `main` push) or run `vercel --prod`.
3. Configure the **Environment Variables**:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   GOOGLE_GENERATIVE_AI_API_KEY=
   ```
4. **Security**: the `SUPABASE_SERVICE_ROLE_KEY` runs only server-side (never expose it in client code). User creation and IAM management depend on it.

---

### 🛡️ Vulnerability Mitigation / Remediação de Vulnerabilidades

- **Remoção de dependências inseguras (`xlsx` / SheetJS)**: O pacote `xlsx` apresentava vulnerabilidades graves de **Prototype Pollution** (GHSA-4r6h-8v6p-xvw6) e **ReDoS** (GHSA-5pgg-2g8v-p4x9), bloqueando scans de segurança (Trivy/npm audit). O pacote foi desinstalado e excluído do repositório por obsolescência, uma vez que a leitura do Excel foi inteiramente substituída pela base local estável em JSON (`requisitos-sd.json`).

> Full technical details (components, RLS, RAG, integrations) in [`docs/official_documentation.md`](docs/official_documentation.md).