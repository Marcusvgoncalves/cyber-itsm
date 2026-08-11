# Especificação Funcional & Manual do Produto — Automação via Agentes MCP

> **Classificação:** Funcional / Produto
> **Módulo:** Copiloto de IA Global · Automação Ativa via MCP (Model Context Protocol)
> **Público:** Analistas SecOps, Gestores, Investidores, QA/Homologação
> **Data:** 2026-08-10

---

## 1. Visão Geral do Produto (Executive Summary)

O **CyberITSM SPN** sempre foi uma plataforma de consulta passiva de inteligência: o Copiloto respondia perguntas sobre segurança, chamados e requisitos, mas **não podia agir** — criar um chamado exigia abrir o Kanban e preencher o formulário manualmente.

Com a **Arquitetura MCP Local**, o CyberITSM evolui para uma **plataforma de automação ativa dirigida por Agentes de IA**. O Copiloto deixa de ser apenas um oráculo e passa a ser um **operador assistido**: a partir da linguagem natural, o usuário pode abrir chamados, mover cards no Kanban e consultar a Base de Conhecimento — com todo o rigor de segurança, validação e auditoria da plataforma.

Esta evolução é **aditiva e sem custo**: implementada com o SDK oficial aberto do MCP, rodando inteiramente dentro do ambiente Node.js/Next.js já existente, sem serviços, sem infraestrutura externa e com **zero risco para a produção**.

### 1.1 O que muda na prática

| Antes (passivo) | Depois (ativo via MCP) |
|---|---|
| "Quais requisitos cobrem autenticação?" → texto | Mesma resposta **+ opção de transformar o achado em chamado** |
| Abrir chamado → navegar até o Kanban, preencher formulário | **"Crie um chamado CRITICAL para o requisito X"** → chamado criado na hora |
| Mover card → arrastar no quadro | **"Mova o chamado XYZ para EM_ANDAMENTO"** → card movido com máquina de estados |
| Risco do laudo de Security QA → reescrever manualmente no chamado | **Um comando transforma o risco do laudo em chamado enriquecido** |
| Parecer de segurança → digitar/formatar em outro editor, sem rastreabilidade | **"Gere o parecer de segurança do recurso X"** → modelagem STRIDE + Markdown pronto para download |

---

## 2. Ferramentas Disponíveis (Catálogo Funcional)

| Ferramenta | O que faz | Quando o usuário deve usar |
|---|---|---|
| `list_active_epics` | Lista os **Épicos Pai ativos** (id + título) do Kanban. Acionada automaticamente pelo Copiloto quando o usuário não informa o Épico. | Sem gatilho direto — o Copiloto a usa para coletar as opções de Épico antes de criar um chamado. |
| `create_kanban_ticket` | Abre um chamado no Kanban com título, descrição, severidade (`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`), **Épico Pai obrigatório** e, opcionalmente, o código do requisito da Base de Conhecimento. | "Crie um chamado...", "Abra um ticket para...", "Registre essa falha..." |
| `move_kanban_card` | Altera o status de um card existente, respeitando a máquina de estados e as permissões de perfil. | "Mova o chamado...", "Passe o card para...", "Atualize o status..." |
| `search_knowledge_base` | Busca requisitos de segurança na Base de Conhecimento (matriz Segura SD + RAG) para fundamentar respostas. | "Qual requisito cobre...?", "Busque requisitos de criptografia...", "O que o NIST diz sobre..." |
| `generate_security_assessment` | Gera **parecer de segurança** com modelagem de ameaças **STRIDE** (título, descrição, categoria, severidade), ancorado em códigos de requisitos, e devolve **Markdown** (.md) pronto para download pelo Frontend. | "Gere um parecer de segurança...", "Faça a modelagem de ameaças do recurso X...", "Elabore o parecer de arquitetura..." |

> O Copiloto decide **automaticamente** qual ferramenta acionar com base na intenção da mensagem. Em **nenhuma** situação as ferramentas são acionadas sem intenção explícita — uma pergunta comum segue respondida em texto normal, como sempre.
>
> **Regra de ouro do Kanban:** se o usuário pedir um chamado sem informar o Épico, o Copiloto **não pergunta cegamente** — ele chama `list_active_epics`, apresenta as opções disponíveis no chat e aguarda a escolha antes de executar `create_kanban_ticket` (DIRETRIZ DE KANBAN no system prompt).

---

## 3. Casos de Uso por Jornada

### 3.1 Jornada Kanban — Abertura e Atualização Automática de Chamados

**Ator:** Analista SecOps (admin/analista) ou Solicitante (apenas criação).

**Fluxo de criação (Épico informado):**
1. O usuário digita no chat: *"Abra um chamado de severidade ALTA para a exposição de chaves na URL, no Épico X"*.
2. O Copiloto reconhece a intenção e aciona `create_kanban_ticket` com `title`, `description`, `severity` e `epic_id`.
3. O MCP local valida os dados (Zod) e **confirma que o Épico existe e está ativo**; resolve o usuário autenticado como responsável e cria o chamado vinculado ao Épico via a mesma Server Action de produção.
4. O chamado nasce com status `ABERTO`, prioridade mapeada (`ALTA → alta`), tags `mcp`/`copiloto`, e dispara notificação + auditoria.
5. O Copiloto responde com o resumo, o ID do chamado e o Épico vinculado.

**Fluxo de criação (Épico NÃO informado — DIRETRIZ DE KANBAN):**
1. O usuário digita: *"Crie um chamado CRITICAL para a falha de criptografia"* — sem informar o Épico.
2. O Copiloto **chama `list_active_epics` primeiro**, lê os Épicos ativos do sistema e os apresenta no chat, perguntando qual o usuário prefere.
3. O usuário responde escolhendo um Épico (ex.: *"o Autenticação de APIs"*).
4. O Copiloto executa `create_kanban_ticket` com o `epic_id` selecionado e conclui o chamado.

**Fluxo de movimentação (Matriz SoD):**
1. *"Mova o chamado a07f…9c para EM_ANDAMENTO."*
2. O Copiloto chama `move_kanban_card` com o `ticket_id` e o novo status.
3. A máquina de estados valida a transição (ex.: `ABERTO → EM_ANDAMENTO` ✅); transições inválidas retornam erro explicativo.
4. Perfil **solicitante** tem a ação **bloqueada pela Matriz SoD** — o Copiloto explica o bloqueio de forma clara.

### 3.2 Jornada Security QA — Do Laudo ao Chamado em Um Único Comando

**Ator:** Analista SecOps.

1. O analista recebe um laudo de Security QA com achados (ex.: requisito `CYBER.SEGURA.CRIP.01` — criptografia ausente).
2. No chat, digita: **"Crie um chamado de severidade CRITICAL para a falha no requisito CYBER.SEGURA.CRIP.01"**.
3. Como o Épico não foi informado, o Copiloto **chama `list_active_epics`** e apresenta os Épicos ativos; o usuário escolhe um.
4. O Copiloto aciona `create_kanban_ticket` com `severity=CRITICAL`, `epic_id` e `requirement_code=CYBER.SEGURA.CRIP.01`.
5. O MCP consulta a Base de Conhecimento, localiza o requisito e **enriquece automaticamente a descrição** do chamado com controle, detalhamento, riscos, OWASP/STRIDE e criticidade — eliminando a digitação manual e garantindo rastreabilidade do laudo para o Kanban.
6. O chamado nasce com prioridade `critica`, vínculo ao Épico, tag com o código do requisito e trilha de auditoria.

> **Benefício:** o risco identificado no laudo vira ação tratada em segundos, com contexto normativo completo e rastreável — sem "copy-paste" e sem perda de informação.

### 3.3 Jornada Base de Conhecimento — Busca de Contexto e Enriquecimento

**Ator:** Todos os perfis.

1. O usuário pergunta: *"Quais requisitos tratam autenticação de APIs?"*.
2. O Copiloto aciona `search_knowledge_base`, que recupera os requisitos mais relevantes (matriz Segura SD v4.1 e, quando habilitado, similaridade vetorial pgvector).
3. O Copiloto fundamenta a resposta com os requisitos recuperados (controle, criticidade, categoria, OWASP/STRIDE).
4. Na mesma conversa, o usuário pode **promover** qualquer requisito recuperado a um chamado com um comando (`create_kanban_ticket` + `requirement_code`).

> **Benefício:** a Base de Conhecimento deixa de ser apenas leitura e passa a alimentar ações concretas no ITSM dentro do fluxo conversacional.

### 3.4 Jornada Parecer de Segurança — Modelagem de Ameaças (STRIDE) com Download

**Ator:** Analista SecOps, Arquitetos e Desenvolvedores.

1. O usuário pede: *"Gere um parecer de segurança/modelagem de ameaças para o recurso de autenticação"*.
2. O Copiloto chama `search_knowledge_base` para ancorar os códigos de requisitos aplicáveis (`requirements[]`).
3. O modelo estrutura as ameaças em `threats[]` (título, descrição, categoria STRIDE e severidade) e chama `generate_security_assessment` com `project_context`, `requirements[]` e `executive_summary`.
4. A ferramenta devolve o parecer em **Markdown**; o Frontend intercepta `toolInvocations` e exibe o botão **"📥 Baixar Parecer de Segurança (.md)"** — o JSON bruto não é renderizado.

> **Benefício:** parecer técnico de AppSec com modelagem STRIDE e rastreabilidade normativa, exportável em um clique, sem copiar/colar.

---

## 4. Guia de Validação e Homologação

### 4.1 Pré-requisitos do ambiente

- Copiloto operacional (chave primária **`SAMBANOVA_API_KEY`** e/ou fallback pago **`OPENROUTER_API_KEY`**; `GEMINI_API_KEY` segue necessária para os embeddings RAG);
- Sessão autenticada no CyberITSM (as ferramentas exigem login);
- Acesso ao Kanban (`/dashboard`) para conferir os chamados criados/movidos.

### 4.2 Roteiro passo a passo (cenário obrigatório)

**Cenário 1 — Criação de chamado CRITICAL com requisito (Security QA → Kanban)**

1. Acesse o chat do Copiloto já autenticado.
2. Digite exatamente:
   > **"Crie um chamado de severidade CRITICAL para a falha no requisito CYBER.SEGURA.CRIP.01"**
3. **Esperado:**
   - O Copiloto chama `list_active_epics` (Épico não informado) e apresenta os Épicos ativos no chat;
   - Após a escolha do usuário, aciona `create_kanban_ticket` (a ferramenta aparece na conversa como parte executada);
   - O chamado é criado no Kanban com:
     - Título coerente com a falha informada;
     - Descrição **enriquecida** com o conteúdo do requisito `CYBER.SEGURA.CRIP.01` (controle, detalhamento, riscos, OWASP/STRIDE);
     - Status `ABERTO`, prioridade `Crítica`, vínculo ao Épico escolhido e tags contendo `CYBER.SEGURA.CRIP.01`;
   - O Copiloto responde confirmando a criação, exibindo ID, título, Épico e status.
4. Verifique no `/dashboard` que o card apareceu na coluna **Aberto** e que a auditoria (`ticket_create`) foi registrada.

**Cenário 2 — Criação simples de chamado (Épico informado)**

1. Digite: *"Abra um chamado de severidade HIGH no Épico 'Autenticação de APIs': senha armazenada em texto plano no arquivo de configuração"*.
2. **Esperado:** chamado criado vinculado ao Épico citado, prioridade `Alta`, status `ABERTO`, e confirmação com ID + Épico.

**Cenário 2b — Épico ausente (DIRETRIZ DE KANBAN)**

1. Digite: *"Abra um chamado de severidade MEDIUM para o vazamento de credenciais em logs"* — **sem informar o Épico**.
2. **Esperado:** o Copiloto **NÃO** pergunta cegamente nem inventa um Épico. Ele chama `list_active_epics`, lista os Épicos ativos no chat e pergunta qual o usuário prefere. Só executa `create_kanban_ticket` após a escolha.

**Cenário 3 — Movimentação de card**

1. Anote o ID de um chamado recém-criado (ex.: a UUID retornada no chat).
2. Digite: *"Mova o chamado `<ID>` para EM_ANDAMENTO"*.
3. **Esperado:** card movido para a coluna **Em Andamento**; resposta de confirmação com o novo status.
4. **Negativo (SoD):** autenticado como **Solicitante**, repita o passo 2. **Esperado:** resposta bloqueada explicando que o perfil não possui permissão para mover cards (Matriz SoD).

**Cenário 4 — Transição inválida (máquina de estados)**

1. Digite: *"Mova o chamado `<ID>` para CANCELADO"* e depois tente mover o mesmo card para `FECHADO` partindo de `CANCELADO`.
2. **Esperado:** erro controlado explicando que `CANCELADO` é um estado terminal (nenhuma transição permitida).

**Cenário 5 — Busca na Base de Conhecimento**

1. Digite: *"Busque requisitos sobre autenticação de APIs"*.
2. **Esperado:** resposta fundamentada com os requisitos recuperados (código, controle, criticidade, OWASP/STRIDE).

**Cenário 6 — Não-disparo (consulta passiva preservada)**

1. Digite uma pergunta puramente informativa: *"Qual a diferença entre NIST e CIS?"*.
2. **Esperado:** resposta em texto normal, **sem** acionamento de ferramenta e sem qualquer efeito colateral no ITSM.

**Cenário 7 — Épico inválido/inexistente**

1. Digite: *"Crie um chamado CRITICAL no Épico '9dca52f6-0000-0000-0000-000000000000' para a falha X"* (UUID inexistente).
2. **Esperado:** erro controlado na tool orientando o uso de `list_active_epics` para obter o `epic_id` correto; **nenhum** chamado é criado.

**Cenário 8 — Geração de parecer de segurança (STRIDE) com download**

1. Digite: *"Gere um parecer de segurança/modelagem de ameaças para o recurso de autenticação de APIs"*.
2. **Esperado:**
   - O Copiloto aciona `search_knowledge_base` (ancoragem dos requisitos aplicáveis) e depois `generate_security_assessment` com `project_context`, `threats[]` (categoria STRIDE e severidade), `requirements[]` e `executive_summary`;
   - Na conversa, **em vez do JSON bruto**, é renderizado o botão **"📥 Baixar Parecer de Segurança (.md)"** quando a tool atinge o estado de sucesso (`output-available`);
   - O clique dispara o **download nativo** do arquivo `.md` com o parecer estruturado (resumo executivo, contexto do projeto, modelagem STRIDE e requisitos exigidos).
3. **Negativo:** se a tool falhar (ex.: sem `threats` ou sem `executive_summary`), o erro controlado é exibido no chat e **nenhum** `.md` é gerado.

### 4.3 Matriz de aceite (checklist do analista/investidor)

| # | Critério de aceite | Resultado |
|---|---|---|
| A1 | Chamado CRITICAL + requisito criado com descrição enriquecida, vínculo ao Épico e tag do código | ☐ |
| A2 | Prioridade mapeada corretamente (CRITICAL→Crítica, HIGH→Alta, MEDIUM→Média, LOW→Baixa) | ☐ |
| A3 | Card criado visível no Kanban com status ABERTO e Épico Pai vinculado | ☐ |
| A4 | Movimentação respeita máquina de estados; transição inválida retorna erro claro | ☐ |
| A5 | Perfil Solicitante bloqueado para mover cards (Matriz SoD) | ☐ |
| A6 | Busca da Base de Conhecimento retorna requisitos relevantes | ☐ |
| A7 | Pergunta informativa NÃO dispara ferramenta (fluxo de texto intacto) | ☐ |
| A8 | Sessão expirada/sem login → ferramenta orienta autenticação sem quebrar o chat | ☐ |
| A9 | Auditoria (`audit_logs`) registra criação/movimentação originada pelo Copiloto | ☐ |
| A10 | Épico ausente → `list_active_epics` é chamado e as opções são apresentadas (DIRETRIZ DE KANBAN) | ☐ |
| A11 | Épico inválido/inexistente → erro controlado, sem criação de chamado | ☐ |
| A12 | Nenhuma tela, rota ou funcionalidade pré-existente apresentou regressão | ☐ |
| A13 | Geração de parecer com modelagem STRIDE e download `.md` pelo botão no chat | ☐ |

### 4.4 Rollback / Kill Switch (garantia de Risco Zero)

A funcionalidade é **totalmente aditiva e reversível**. Para restaurar o comportamento exato do pré-MCP:
1. Remova as linhas de injeção em `app/api/chat/route.ts` (`createCopilotTools` / `tools` / `stopWhen` / bloco `MCP_TOOLS_GUIDANCE` / `DIRETRIZ DE KANBAN`);
2. Opcionalmente, remova o diretório `lib/mcp/` e a dependência `@modelcontextprotocol/sdk` do `package.json`.

A sincronização de banco (enum `TicketType`, `scripts/sync-ticket-type-enum.sql`) é **aditiva e não destrutiva**: os dados foram preservados e a aplicação Supabase é compatível com o tipo enum. Não há necessidade de reverter o banco para remover o MCP.

---

## 5. Glossário Rápido

- **MCP (Model Context Protocol):** padrão aberto que padroniza como agentes de IA acessam ferramentas/recursos externos.
- **Tool (Ferramenta):** capacidade executável exposta ao modelo (criar/mover chamado, buscar requisito).
- **RAG (Retrieval-Augmented Generation):** geração de resposta fundamentada em recuperação de conhecimento.
- **Matriz SoD (Separation of Duties):** política RBAC do CyberITSM que separa poderes por perfil (admin/analista/solicitante).
- **Multi-step:** mecanismo do AI SDK que permite ao modelo executar uma ferramenta e, em seguida, produzir a resposta final com base no resultado.

---

*Documento técnico complementar: [Arquitetura MCP Local](../architecture/MCP_ARCHITECTURE.md).*
