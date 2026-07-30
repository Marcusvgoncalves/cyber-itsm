# CyberITSM 🛡️

**CyberITSM** é um sistema de Gerenciamento de Serviços de TI (ITSM) especializado em **Arquitetura de Cibersegurança**. O projeto combina a experiência de uso ágil e visual do **Jira** (quadros Kanban, visualizações de listas, painéis laterais de detalhes) com a rigidez e os controles exigidos por auditorias de segurança e governança de TI.

---

## 🚀 Tecnologias Utilizadas

- **Framework**: [Next.js](https://nextjs.org/) (App Router) + TypeScript
- **Estilização & UI**: [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Backend as a Service (BaaS)**: [Supabase](https://supabase.com/) (PostgreSQL, Auth com MFA, RLS, Storage)
- **Deploy**: Vercel (Frontend) & Supabase (Database/Backend)

---

## 🔒 Alinhamento com Frameworks de Cibersegurança

Diferente de um ITSM tradicional, o CyberITSM categoriza e gerencia os chamados (tickets) com base nos principais frameworks globais de segurança da informação:

1. **NIST CSF (Cybersecurity Framework)**: Identify, Protect, Detect, Respond, Recover.
2. **CIS Controls**: Mapeamento direto de ações de controle (ex: CIS Control 1: Inventory and Control of Enterprise Assets).
3. **ISO/IEC 27001**: Controles do Anexo A (ex: A.8 - Asset Management, A.12 - Operations Security).
4. **SABSA (Sherwood Applied Business Security Architecture)**: Camadas de arquitetura (Business, Conceptual, Logical, Physical, Component, Operational).

---

## 🛡️ Segurança e OWASP Top 10

O desenvolvimento do sistema prioriza a segurança desde a base:
- **Sanitização de Inputs**: Proteção contra injeções SQL e Cross-Site Scripting (XSS).
- **Row Level Security (RLS)**: No Supabase, garantindo que usuários só acessem dados autorizados pelo RBAC.
- **MFA (Multi-Factor Authentication)**: Autenticação multifator nativa.
- **Headers de Segurança**: Configurações de Content Security Policy (CSP), HSTS e Anti-CSRF.
- **Audit Log**: Histórico imutável de alterações em chamados.

---

## 📂 Estrutura de Pastas do Projeto

```text
cyber-itsm/
├── src/
│   ├── app/                 # Rotas, layouts e páginas (Next.js App Router)
│   │   ├── globals.css      # Estilos globais (Tailwind CSS v4)
│   │   ├── layout.tsx       # Layout raiz do sistema
│   │   └── page.tsx         # Página de entrada / Dashboard
│   ├── components/          # Componentes reutilizáveis do sistema
│   │   ├── ui/              # Componentes base do shadcn/ui (ex: button, dialog)
│   │   └── shared/          # Componentes customizados compartilhados (ex: sidebar, kanban)
│   ├── lib/                 # Utilitários e integrações
│   │   ├── supabase.ts      # Inicialização do cliente Supabase
│   │   └── utils.ts         # Funções utilitárias (ex: cn para Tailwind)
│   └── types/               # Definições de tipos TypeScript
├── public/                  # Arquivos estáticos (imagens, ícones)
├── components.json          # Configuração do shadcn/ui
├── tsconfig.json            # Configuração do TypeScript
├── package.json             # Dependências e scripts npm
└── .env.local.example       # Modelo de variáveis de ambiente
```

---

## 📋 Roadmap de Desenvolvimento

- [x] **FASE 1: Setup e Infraestrutura** — Criação do projeto, Tailwind, Supabase Client e shadcn/ui.
- [ ] **FASE 2: Autenticação e Banco** — Schema PostgreSQL (RLS, RBAC, tabelas) e fluxos de Auth/MFA.
- [ ] **FASE 3: Core do ITSM (Estilo Jira)** — Dashboard, Kanban e abertura de chamados mapeando os frameworks de segurança.
- [ ] **FASE 4: Colaboração e Anexos** — Chat de comentários, logs de auditoria e upload de evidências no Supabase Storage.
- [ ] **FASE 5: Base de Conhecimento e APIs** — Artigos de arquitetura (KB) e API endpoints prontos para Webhooks.
- [ ] **FASE 6: Revisão de Segurança e Deploy** — Auditoria de dependências, headers de segurança e deploy final na Vercel.

---

## ⚙️ Instalação e Execução Local

### Pré-requisitos
- Node.js (v18+)
- Conta no Supabase (Gratuito)

### Passos para Rodar

1. **Clonar o Repositório**
   ```bash
   git clone https://github.com/seu-usuario/cyber-itsm.git
   cd cyber-itsm
   ```

2. **Instalar Dependências**
   ```bash
   npm install
   ```

3. **Configurar Variáveis de Ambiente**
   Copie o arquivo de exemplo e preencha com suas chaves do Supabase:
   ```bash
   cp .env.local.example .env.local
   ```

4. **Executar em Modo de Desenvolvimento**
   ```bash
   npm run dev
   ```
   Abra [http://localhost:3000](http://localhost:3000) no seu navegador.
