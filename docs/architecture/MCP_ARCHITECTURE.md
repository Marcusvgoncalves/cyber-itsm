# Arquitetura MCP Local — CyberITSM SPN

> **Classificação:** Técnica / Arquitetura
> **Módulo:** Copiloto de IA Global · Barramento de Automação MCP (Model Context Protocol)
> **Princípios vinculantes:** `RISCO ZERO PARA A PRODUÇÃO` (100% aditivo e isolado) · `CUSTO ZERO` (SDK oficial, in-process no runtime Node.js/Next.js existente, sem serviços externos)
> **Data:** 2026-08-10

---

## 1. Objetivo

Adicionar ao CyberITSM SPN uma camada de **automação ativa via agentes de IA**: o Copiloto passa a **executar ações reais no ITSM** (abrir chamados, mover cards no Kanban e consultar a Base de Conhecimento RAG) diretamente a partir da conversa, sem exigir infraestrutura, serviço ou licença adicional.

O Model Context Protocol (MCP) é o padrão aberto escolhido para expor essas capacidades. O servidor MCP é **local e in-process**: ele roda dentro do mesmo processo do Next.js, consumindo apenas o SDK oficial `@modelcontextprotocol/sdk` e o runtime já existente.

---

## 2. Diagrama da Arquitetura (Fluxo Completo)

### 2.1 Diagrama em Mermaid

```mermaid
flowchart LR
    subgraph Cliente["Perímetro Cliente / Browser"]
        U[("Usuário Autenticado")]
        UI[Frontend Next.js<br/>useChat · Kanban · Security QA]
    end

    subgraph Next["Next.js 16 · App Router (Processo Único — CUSTO ZERO)"]
        AR[Agent Router<br/>app/api/chat/route.ts<br/>Esteira Multiagente + Fallback 429]
        AD[lib/mcp/adapter.ts<br/>MCP Client · Vercel AI SDK Bridge<br/>jsonSchema → tool() + closure de auth]
        SRV[lib/mcp/server.ts<br/>MCP Server Local<br/>McpServer · @modelcontextprotocol/sdk]
        TL[lib/mcp/tools.ts<br/>list_active_epics<br/>create_kanban_ticket<br/>move_kanban_card<br/>search_knowledge_base<br/>generate_security_assessment]
        KB[lib/mcp/knowledge-base.ts<br/>RAG · matriz 314 requisitos + pgvector<br/>Top-K ≤ 3 · cosine > 0.78 · payload comprimido]
    end

    subgraph Dados["Camada de Persistência"]
        PR[Prisma ORM v7<br/>knowledge_articles · qa_results]
        SB[(Supabase PostgreSQL 16<br/>tickets · sprints · audit_logs · users_profiles)]
    end

    U -->|Comando em linguagem natural| UI
    UI -->|POST /api/chat · useChat| AR
    AR -->|tools: ToolSet + stopWhen: isStepCount(5)| AD
    AD -->|listTools() · callTool()| SRV
    SRV -->|Registro de Tools com Zod| TL
    TL -->|createTicket / updateTicket<br/>(Server Actions testadas)| SB
    TL -->|searchKnowledgeBase| KB
    KB -->|pgvector / SELECT| PR
    KB -->|matriz requisitos (JSON)| SB
    AR -.->|Resposta em texto normal (sem tool calls)| UI
```

### 2.2 Diagrama em Texto (ASCII)

```
Usuário ──▶ Frontend (Next.js) ──▶ Agent Router ──▶ MCP Client (Vercel AI SDK Bridge)
                                                                 │
                                                                 ▼
                                                        MCP Server (Tools Local)
                                                                 │
                        ┌────────────────────────┬──────────────────────┬──────────────────────┬──────────────────────┐
        ▼                        ▼                      ▼                      ▼                      ▼
list_active_epics   create_kanban_ticket  move_kanban_card  search_knowledge_base  generate_security_assessment
        │                        │                      │                      │                      │
        ▼                        ▼                      ▼                      ▼                      ▼
  Prisma (tickets)      Prisma / Supabase      Prisma / Supabase   RAG (pgvector + matriz)   Markdown (parecer STRIDE)
```

---

## 3. Componentes e Responsabilidades

### 3.1 `lib/mcp/server.ts` — MCP Server Local (isolado)

Instancia o `McpServer` oficial do SDK (`@modelcontextprotocol/sdk/server/mcp.js`) com as capacidades `tools`. Registra as ferramentas declaradas em `lib/mcp/tools.ts` com seus **schemas Zod** (fonte da verdade da higienização de dados).

- `listTools()` → devolve as definições MCP reais (`name`, `title`, `description`, `inputSchema` em **JSON Schema** derivado de Zod via `z.toJSONSchema`).
- `callTool(name, args, ctx)` → **valida os argumentos com Zod** antes de executar; em falha de validação devolve `isError` controlado (nunca quebra o stream).
- `startStdio()` → **opcional**; expõe o mesmo servidor a clientes MCP externos (ex.: Claude Desktop) via transporte stdio, reutilizando 100% da lógica (zero custo adicional).

> Isolamento: nenhuma rota/layout existente é alterado por este módulo. O servidor roda in-process, sem portas, sem rede e sem dependência externa.

### 3.2 `lib/mcp/tools.ts` — Ferramentas do ITSM

| Tool | Entrada (Zod) | Ação | Camada de dados |
|---|---|---|---|
| `list_active_epics` | `limit?` (1–100) | Lista os Épicos Pai ativos (type `EPICO`, status `ABERTO`/`EM_ANDAMENTO`/`BLOQUEADO`) com `id` + `title`. Usada OBRIGATORIAMENTE antes de `create_kanban_ticket` quando o Épico não foi informado | `prisma.ticket.findMany` (lazy) → **PostgreSQL `tickets`** |
| `create_kanban_ticket` | `title`, `description?`, `severity` (`LOW\|MEDIUM\|HIGH\|CRITICAL`), `epic_id` (**OBRIGATÓRIO**), `requirement_code?` | Abre chamado no Kanban (tipo TAREFA, status ABERTO) **vinculado ao Épico Pai**; valida o Épico (existência + ativo) antes de escrever; enriquece descrição com o requisito quando `requirement_code` informado; mapeia severidade → prioridade (`CRITICAL→critica`) | `createTicket` (Server Action) → **Supabase `tickets`** |
| `move_kanban_card` | `ticket_id`, `status` (`ABERTO\|EM_ANDAMENTO\|BLOQUEADO\|FECHADO\|CANCELADO`) | Altera status respeitando a máquina de estados e o guardrail de Épicos; aplica Matriz SoD (Solicitante bloqueado) | `updateTicket` (Server Action) → **Supabase `tickets`** |
| `search_knowledge_base` | `query`, `limit?` (1–3) | Busca requisitos na Base de Conhecimento: camada léxica determinística (matriz 314 requisitos) + camada vetorial pgvector **opt-in** (`MCP_RAG_USE_PGVECTOR=1`); **Top-K ≤ 3**, similaridade de cosseno **> 0.78** e payload comprimido (`requirement_code` + `content` ≤ 300 chars) | `lib/mcp/knowledge-base.ts` → **JSON + Prisma `knowledge_articles`** |
| `generate_security_assessment` | `project_context`, `threats[]` (`title`, `description`, `stride_category`, `severity`), `requirements[]`, `executive_summary` | Gera **parecer de segurança** com modelagem de ameaças **STRIDE** e devolve **Markdown** (.md) pronto para download no Frontend | **Sem persistência** — saída Markdown (via `toolInvocations`) |

Todas as ferramentas reutilizam as **Server Actions testadas em produção** (`createTicket`, `updateTicket`), preservando notificações por e-mail, trilha de auditoria (`audit_logs`), validação de domínio e revalidação do Kanban — sem duplicar regra de negócio.

### 3.3 `lib/mcp/adapter.ts` — MCP Client (Bridge para o Vercel AI SDK)

Ponte entre o MCP local e a propriedade `tools` do `streamText`/`generateText`:

1. `server.listTools()` fornece as definições MCP (JSON Schema);
2. cada definição é convertida em `tool()` do AI SDK via `jsonSchema(...)` — **sem conversões manuais e sem duplicação de schema**;
3. `execute` chama `server.callTool(...)` (revalidação Zod + execução de domínio);
4. o contexto de autenticação é **resolvido EAGERLY na rota** e injetado por **closure** — sem estado global e sem leitura tardia de cookies durante o streaming.

As ferramentas **só disparam quando há intenção explícita do modelo**. Sem tool call, a resposta de texto normal flui intacta.

### 3.4 `app/api/chat/route.ts` — Injeção Silenciosa (aditiva)

A rota existente do Copiloto é alterada de forma **estritamente aditiva**:

- `createCopilotTools(authContext)` constrói o `ToolSet` a partir do MCP local;
- `tools` + `stopWhen: isStepCount(5)` são passados ao `streamText` (multi-step habilitado **apenas quando o modelo invoca tools**; o comportamento de texto normal não muda — `stopWhen` só é avaliado quando há tool results);
- o `SYSTEM_PROMPT` recebe a **DIRETRIZ DE KANBAN** (workflow enforcement): se o usuário pedir para criar um chamado e não informar o Épico, o modelo é **PROIBIDO** de perguntar cegamente — deve chamar `list_active_epics` primeiro e apresentar as opções;
- o bloco `MCP_TOOLS_GUIDANCE` expõe as 5 ferramentas, marcando `epic_id` como **OBRIGATÓRIO** em `create_kanban_ticket`;
- **PODA DE CONTEXTO / TOKEN LIMITING** (evita HTTP 413/TPM nos planos gratuitos): histórico enviado com `messages.slice(-5)`; RAG do chat limitado a **Top-K ≤ 3** com similaridade de cosseno **> 0.78** e payload comprimido (`requirement_code` + `content` ≤ 300 chars por requisito); a camada pgvector (`knowledge-base.ts`) limita a **Top-K ≤ 3** e trunca conteúdo em **300 chars**;
- **ESTEIRA PRIMÁRIA (chat):** provedor primário **SambaNova** (`Meta-Llama-3.3-70B-Instruct`, gratuitos) ➔ secundário **SambaNova** (`Meta-Llama-3.1-8B-Instruct`) ➔ **OpenRouter** `deepseek/deepseek-chat` (pago) ➔ **OpenRouter** `claude-3-5-haiku` (pago); Groq não é mais usado no chat;
- nenhuma lógica de RAG, tokenização, fallback de agentes ou formato de streaming existente foi removido/alterado.

---

## 4. Fronteiras de Segurança (RBAC + Zod)

A segurança segue o princípio **defesa em profundidade**, com quatro camadas independentes:

### 4.1 Camada 1 — Autenticação (Sessão)

Toda execução de ferramenta exige sessão válida (`getAuthService().getUser()`). Sem sessão, a tool devolve `isError` com mensagem orientando o login — o chat continua operacional em texto normal.

### 4.2 Camada 2 — Autorização (Matriz SoD / RBAC)

Reutiliza a matriz SoD existente (`lib/rbac.ts` + `lib/auth`) e as Server Actions que já aplicam `checkRole`:

| Perfil | Abrir chamado (`create_kanban_ticket`) | Mover card (`move_kanban_card`) |
|---|---|---|
| `admin` (ADMIN) | ✅ | ✅ |
| `analista` (USUARIO) | ✅ | ✅ |
| `solicitante` (SOLICITANTE) | ✅ (criação) | ❌ **Bloqueado** — mensagem explícita de SoD |

O bloqueio é aplicado em duas camadas: **mensagem amigável imediata** na tool (quando `role === 'solicitante'`) e **revalidação no domínio** (`updateTicket`/`moveTicket`), garantindo que nenhuma chamada alternativa contorne a política.

### 4.3 Camada 3 — Higienização de Dados (Zod Validation)

- O `inputSchema` Zod valida **todos os argumentos da ferramenta** (enum de severidade/status, limites de tamanho, tipos);
- a validação ocorre **duas vezes**: no MCP Server local (`callTool`) e novamente no lado do AI SDK (validação do tool call do modelo via JSON Schema);
- qualquer argumento inválido retorna `isError` controlado — nunca chega ao banco;
- strings são sanitizadas (trim) e limitadas (ex.: título ≤ 200, descrição ≤ 4000).

### 4.4 Camada 4 — Auditoria & Governança

Como as tools delegam às Server Actions de produção, **toda escrita gera trilha de auditoria** (`audit_logs`), notificação e revalidação do Kanban — mesmo quando originada pelo agente. O framework de origem (`framework_origem`) e as tags (`mcp`, `copiloto`, código do requisito) permitem identificar na UI os chamados criados via IA.

---

## 5. Estratégia de Resiliência (Fallback)

### 5.1 Falha do modelo (provedor / rede)

A esteira multiagente é **encadeada**: **SambaNova** (`Meta-Llama-3.3-70B-Instruct`) ➔ **SambaNova** (`Meta-Llama-3.1-8B-Instruct`) ➔ **OpenRouter** (`deepseek/deepseek-chat`, pago) ➔ **OpenRouter** (`claude-3-5-haiku`, pago), com fallback via `try/catch` e disparo EAGER da requisição (`await result.response`). A presença das tools **não interfere** nesse mecanismo — se um provedor falhar, o próximo agente é tentado com as mesmas tools.

### 5.2 Falha ou cancelamento da tool call

| Cenário | Comportamento |
|---|---|
| Modelo cancela/desiste da tool | `stopWhen: isStepCount(5)` não força execução; o modelo responde em texto normal. Nada é executado. |
| Modelo chama tool com argumentos inválidos | Zod rejeita → `isError` → o AI SDK registra `tool-error` e o modelo explica/ajusta a chamada no próximo passo. |
| Tool falha na execução (DB/regra) | `execute` devolve `isError` (nunca lança para fora) → o modelo informa o usuário e sugere a correção. |
| DB indisponível (Supabase/Prisma) | Exceção capturada → `isError` amigável; o streaming continua; nenhuma tela/layout quebra. |
| RAG vetorial indisponível | Camada pgvector **degrada em silêncio** para a camada léxica determinística (matriz de requisitos). |
| Tool executada com sucesso | Resultado (estruturado) volta ao modelo, que sintetiza a resposta final ao usuário (multi-step). |

### 5.3 Isolamento de falhas (princípio do interruptor)

Todo o barramento MCP é **aditivo**: se qualquer ferramenta falhar, a exceção é capturada dentro de `callTool` e convertida em `isError` — a rota `/api/chat` e o fluxo de texto nunca são afetados. Para desligar completamente as tools (comportamento idêntico ao pré-MCP), basta remover as 3 linhas de injeção em `app/api/chat/route.ts` — **nenhum outro arquivo precisa mudar**.

---

## 6. Fronteiras de Isolamento (Risco Zero)

| Recurso | Garantia |
|---|---|
| Rotas / API existentes | Nenhuma rota removida ou alterada além da injeção aditiva em `/api/chat`. |
| Layout / UI | Nenhum componente visual alterado. |
| Banco de dados | Sincronização cirúrgica e **não destrutiva**: enum `TicketType` criado + coluna `tickets.type` convertida `TEXT → enum` (dados preservados). Escritas reutilizam as Server Actions de produção. |
| .env / variáveis | Nenhuma variável obrigatória nova. `MCP_RAG_USE_PGVECTOR` é **opcional** (default off). |
| Custos | `@modelcontextprotocol/sdk` é open source (MIT); execução in-process, sem transporte de rede, sem serviço externo. |
| Reversão | Remover o import + as linhas de injeção na rota devolve 100% do comportamento do app; o enum `TicketType` é aditivo e compatível com a aplicação Supabase. |

---

## 7. Árvore de Arquivos

```
lib/mcp/
├── types.ts            # Contratos compartilhados (McpToolDefinition, McpToolResult, McpExecutionContext)
├── knowledge-base.ts   # RAG: matriz de 314 requisitos + pgvector opt-in (Top-K ≤ 3 / 300 chars / cutoff 0.78)
├── tools.ts            # Implementação das 5 ferramentas do ITSM (Zod + RBAC + Server Actions)
├── server.ts           # MCP Server local in-process (@modelcontextprotocol/sdk) + stdio opcional
└── adapter.ts          # Bridge MCP → Vercel AI SDK (jsonSchema → tool() + closure de auth)

app/api/chat/route.ts   # Injeção aditiva (import + tools + stopWhen + DIRETRIZ DE KANBAN + poda de contexto)
lib/llm/agent-router.ts # Roteador do llm-proxy + chat — SambaNova (Llama 70B/8B) primário, OpenRouter (DeepSeek/Claude) pago
scripts/sync-ticket-type-enum.sql  # Migração cirúrgica (enum TicketType) — idempotente, não destrutiva
```

---

## 8. Sincronização do Banco de Dados (enum `TicketType`)

A tabela `tickets` do Supabase foi criada manualmente (`supabase-schema.sql`) com `type TEXT` + CHECK, enquanto o schema Prisma declara o enum PostgreSQL `TicketType`. Sem o enum no banco, as queries Prisma (ex.: `list_active_epics`) falhavam com `type "public.TicketType" does not exist` (bind do parâmetro como tipo do enum).

**Decisão — NÃO usar `prisma db push`:** o schema Prisma cobre apenas o bounded context de Security QA + `Ticket`/`Sprint`. O banco real contém dezenas de tabelas ITSM fora do schema (`users_profiles`, `audit_logs`, `ticket_statuses`…) que o push **droparia**, além de falhar na introspecção (`P4002` — FK `users_profiles` → `auth.users`).

**Solução cirúrgica aplicada** via `npx prisma db execute --file scripts/sync-ticket-type-enum.sql`:
1. Cria o enum `public."TicketType"` (`EPICO`, `ATIVIDADE`, `TAREFA`) se ausente (idempotente);
2. Dropa a CHECK legada `tickets_type_check` (bloqueava o cast para enum);
3. Converte `tickets.type` de `TEXT` → `TicketType` com `USING "type"::"public"."TicketType"` (**dados preservados**);
4. Restaura o default `'TAREFA'::"TicketType"` e dispara `NOTIFY pgrst, 'reload schema'` (recarrega o cache do PostgREST).

> Obs.: não há enum `TicketStatus` no schema Prisma — o `status` é `String`, portanto nada foi criado para ele. A migração é **aditiva** e compatível com as operações Supabase existentes.

---

*Documento técnico complementar: [Manual Funcional e de Homologação](../functional/MCP_FUNCTIONAL_SPEC.md).*
