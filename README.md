# CyberITSM SPN 🛡️

**CyberITSM SPN** é uma plataforma corporativa de IT Service Management (ITSM) especializada em **Arquitetura de Cibersegurança e Conformidade Regulatória**. O projeto foi reconstruído do zero utilizando o framework **Next.js (App Router)** integrado nativamente ao **Supabase (BaaS)**, oferecendo um quadro Kanban interativo completo para controle de atividades de mitigação de vulnerabilidades corporativas, seguindo a paleta de cores e tipografia clara do design system **Mistica da Vivo Telefônica**.

---

## 📐 Desenho de Arquitetura C4 (Nível 2 e Nível 3)

Abaixo está o mapeamento visual interativo dos limites do sistema, contêineres internos e conexões com microsserviços e provedores externos (IAM / IGA). O sistema agora conta com um **Mapa de Arquitetura Interativo** no dashboard de Administração.

### 🚀 Tecnologias Adotadas

| Camada / Componente | Tecnologia | Descrição |
| :--- | :--- | :--- |
| **Frontend UI** | React 19 / Tailwind CSS v4 (Mistica) | Cores da marca, tipografia Outfit e responsividade premium com micro-animações. |
| **Frontend Logic** | Next.js Client Components | Gerenciamento de estado local reativo e drag-and-drop nativo de cartões. |
| **Backend API** | Next.js Server Actions & Middleware | Lógica do servidor executando sob Vercel Serverless. Proteção de rotas com cookies HTTP. |
| **Agente de IA** | Vercel AI SDK Mock (rule-based) | Assistente SecOps funcional em `app/api/chat/route.ts` baseado em regras/keywords. Sem LLM externo por padrão; pronto para integrar OpenAI/Gemini via Vercel AI SDK quando uma API Key for configurada. |
| **Banco de Dados** | Supabase PostgreSQL | Persistência na nuvem com políticas estritas de Row Level Security (RLS) habilitadas. |
| **Autenticação & MFA** | Supabase Auth & TOTP (SHA-1) | Autenticação com sessão segura e MFA configurável com onboarding via QR Code. |
| **Integração IAM / IGA** | Adaptadores Simulados (Entra ID, Keycloak, OAM, Sailpoint) | Fluxo de governança de identidades e fila de aprovação de perfis (Identity Requests). |

---

## 🔒 Jornada de Segurança & Políticas Aplicadas

### 1. Complexidade de Senhas Obrigatória
Todas as credenciais locais do sistema devem cumprir a política estrita de complexidade de senhas (12+ caracteres contendo maiúsculas, minúsculas, dígitos numéricos e símbolos especiais). Validação visual reativa durante a redefinição de senha.
*Exemplo de senha padrão:* `CyberITSM@2026!Password`

### 2. Fluxo de Autenticação com Sessão Segura e Middleware
- Verificação de sessão gerenciada no `middleware.ts` do Next.js.
- Redirecionamento automático se a sessão expirar ou o usuário não estiver logado.

### 3. Configuração de MFA Obrigatória no Primeiro Acesso
- No primeiro login, caso o usuário não possua o MFA configurado no perfil (`mfa_setup_complete == false`), o sistema o redireciona automaticamente para um painel de Onboarding na tela de login.
- Exibe o QR Code e chave secreta para sincronização em dispositivos móveis (ex: Google Authenticator). A sessão só é liberada e o cookie `mfa_verified` gravado após a validação inicial do código de 6 dígitos.
- Master Code de Teste no Sandbox: `123456`
- **MFA habilitado para todos os usuários**: as colunas `mfa_secret` e `mfa_setup_complete` são preenchidas para toda a base (`users_profiles`) pelo provisionamento (ver seção abaixo), tornando o segundo fator obrigatório para todas as contas.

### 4. Provisionamento de Usuário Administrador & MFA
Para criar um usuário **super admin** com senha forte e habilitar o MFA para todos os usuários diretamente no Supabase (service role):
1. Adicione a chave em `.env.local` (o arquivo é ignorado pelo Git):
   ```env
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx   # Settings → API → service_role
   ```
2. Crie o usuário em `auth.users` (o trigger `on_auth_user_created` cria o perfil em `users_profiles` com a `role` vinda de `user_metadata.role`):
   ```sql
   select auth.admin_create_user(
     email         => 'colaborador@telefonica.com',
     password      => 'SenhaForte@2026!x',
     email_confirm => true,
     user_metadata => '{"role":"admin","full_name":"Colaborador"}'::jsonb
   );
   ```
3. Habilite o MFA para todos os perfis gerando uma chave Base32 válida e marcando `mfa_setup_complete`:
   ```sql
   CREATE OR REPLACE FUNCTION public.gen_base32_secret()
   RETURNS TEXT AS $$
   DECLARE alphabet TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; out TEXT := ''; i INT;
   BEGIN
     FOR i IN 1..16 LOOP out := out || substr(alphabet, 1 + floor(random()*32)::int, 1); END LOOP;
     RETURN out;
   END $$ LANGUAGE plpgsql;

   UPDATE public.users_profiles
   SET mfa_secret = COALESCE(mfa_secret, public.gen_base32_secret()),
       mfa_setup_complete = TRUE
   WHERE mfa_setup_complete = FALSE OR mfa_secret IS NULL;
   ```
   Os usuários autenticam com o código TOTP do autenticador ou o código de homologação `123456` (sandbox).

### 5. Controle de Acesso Baseado em Função (RBAC) para C4 e Logs
- Apenas usuários com a função **Admin** podem visualizar o Desenho de Arquitetura C4 interativo e o histórico de Logs de Auditoria do sistema. Outros perfis são bloqueados pelo middleware e redirecionados.

### 6. Estado da Feature de IA
- A feature de IA está **habilitada e funcional como mock (rule-based)**.
- UI: `components/ai-chat.tsx` (FAB) renderizada em todas as páginas do dashboard.
- Endpoint: `app/api/chat/route.ts` responde por regras/keywords (sem chave de API externa).
- Para IA generativa real: adicionar `ai`/`@ai-sdk/openai` ao `package.json` e substituir a resposta do endpoint pelo SDK + API Key (`OPENAI_API_KEY`/`GEMINI_API_KEY`). Nenhuma chave é necessária para o mock funcionar.

---

## ⚙️ Execução Local / Running Locally

1. **Instale as dependências**:
   ```bash
   npm install
   ```

2. **Configuração de Variáveis de Ambiente**:
   Crie um arquivo `.env.local` na raiz com as chaves do seu projeto Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=seu_projeto_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=seu_projeto_supabase_anon_key
   ```
   > Chave opcional apenas para operações de provisionamento no servidor (criar usuário admin, habilitar MFA para todos):
   > ```env
   > SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
   > ```

3. **Banco de Dados**:
   Copie o conteúdo de [supabase-schema.sql](supabase-schema.sql) e execute no SQL Editor do painel do seu projeto Supabase para criar as tabelas, RLS, triggers e dados sementes (Seeds) necessários.
   > ⚠️ **Projetos com schema pré-existente/incompleto**: se o banco já possui apenas tabelas antigas (ex.: só `users_profiles` e `tickets`, sem colunas de MFA), não rode o script destrutivo. Adicione manualmente as colunas `mfa_secret`, `mfa_setup_complete`, `reset_token` e `reset_token_expires_at` em `users_profiles` e crie as tabelas/triggers/policies restantes (veja [docs/official_documentation.md](docs/official_documentation.md) para a migração aditiva).

4. **Inicie o Servidor de Desenvolvimento**:
   ```bash
   npm run dev
   ```

5. **Acesso**: Abra `http://localhost:3000` no navegador.
   *Credenciais de teste padrão:* `joao.secops@telefonica.com` / `CyberITSM@2026!Password`

---

## 🧪 Verificando o Código / Typecheck & Linting

Para validar a integridade estática das rotas, tipos e componentes do Next.js:
```bash
npx tsc --noEmit
npm run build
```

---

## ☁️ Publicação e Arquitetura de Deploy (Vercel)

O projeto adota uma arquitetura de implantação nativa e simplificada no ecossistema Vercel:

1. **Vercel Hosting**: As páginas Next.js, Server Actions, imagens estáticas e middleware são empacotados e hospedados na infraestrutura global CDN/Edge da Vercel.
2. **Deploy Automático**: Conecte o repositório GitHub ao painel da Vercel para acionar novos deploys automaticamente a cada push na branch `main`. Insira as variáveis de ambiente do Supabase nas configurações de Environment Variables do projeto na Vercel.
3. **Deploy por Linha de Comando**:
   ```bash
   vercel --prod
   ```
   