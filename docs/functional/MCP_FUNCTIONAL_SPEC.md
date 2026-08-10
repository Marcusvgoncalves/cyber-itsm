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

---

## 2. Ferramentas Disponíveis (Catálogo Funcional)

| Ferramenta | O que faz | Quando o usuário deve usar |
|---|---|---|
| `create_kanban_ticket` | Abre um chamado no Kanban com título, descrição, severidade (`LOW`/`MEDIUM`/`HIGH`/`CRITICAL`) e, opcionalmente, o código do requisito da Base de Conhecimento. | "Crie um chamado...", "Abra um ticket para...", "Registre essa falha..." |
| `move_kanban_card` | Altera o status de um card existente, respeitando a máquina de estados e as permissões de perfil. | "Mova o chamado...", "Passe o card para...", "Atualize o status..." |
| `search_knowledge_base` | Busca requisitos de segurança na Base de Conhecimento (matriz Segura SD + RAG) para fundamentar respostas. | "Qual requisito cobre...?", "Busque requisitos de criptografia...", "O que o NIST diz sobre..." |

> O Copiloto decide **automaticamente** qual ferramenta acionar com base na intenção da mensagem. Em **nenhuma** situação as ferramentas são acionadas sem intenção explícita — uma pergunta comum segue respondida em texto normal, como sempre.

---

## 3. Casos de Uso por Jornada

### 3.1 Jornada Kanban — Abertura e Atualização Automática de Chamados

**Ator:** Analista SecOps (admin/analista) ou Solicitante (apenas criação).

**Fluxo de criação:**
1. O usuário digita no chat: *"Abra um chamado de severidade ALTA para a exposição de chaves na URL"*.
2. O Copiloto reconhece a intenção, monta a chamada da ferramenta `create_kanban_ticket` e confirma a execução.
3. O MCP local valida os dados (Zod), resolve o usuário autenticado como responsável e cria o chamado via a mesma Server Action de produção.
4. O chamado nasce com status `ABERTO`, prioridade mapeada (`ALTA → alta`), tags `mcp`/`copiloto`, e dispara notificação + auditoria.
5. O Copiloto responde com o resumo e o ID do chamado.

**Fluxo de movimentação (Matriz SoD):**
1. *"Mova o chamado a07f…9c para EM_ANDAMENTO."*
2. O Copiloto chama `move_kanban_card` com o `ticket_id` e o novo status.
3. A máquina de estados valida a transição (ex.: `ABERTO → EM_ANDAMENTO` ✅); transições inválidas retornam erro explicativo.
4. Perfil **solicitante** tem a ação **bloqueada pela Matriz SoD** — o Copiloto explica o bloqueio de forma clara.

### 3.2 Jornada Security QA — Do Laudo ao Chamado em Um Único Comando

**Ator:** Analista SecOps.

1. O analista recebe um laudo de Security QA com achados (ex.: requisito `VIVO.SEGURA.CRIP.01` — criptografia ausente).
2. No chat, digita: **"Crie um chamado de severidade CRITICAL para a falha no requisito VIVO.SEGURA.CRIP.01"**.
3. O Copiloto aciona `create_kanban_ticket` com `severity=CRITICAL` e `requirement_code=VIVO.SEGURA.CRIP.01`.
4. O MCP consulta a Base de Conhecimento, localiza o requisito e **enriquece automaticamente a descrição** do chamado com controle, detalhamento, riscos, OWASP/STRIDE e criticidade — eliminando a digitação manual e garantindo rastreabilidade do laudo para o Kanban.
5. O chamado nasce com prioridade `critica`, tag com o código do requisito e trilha de auditoria.

> **Benefício:** o risco identificado no laudo vira ação tratada em segundos, com contexto normativo completo e rastreável — sem "copy-paste" e sem perda de informação.

### 3.3 Jornada Base de Conhecimento — Busca de Contexto e Enriquecimento

**Ator:** Todos os perfis.

1. O usuário pergunta: *"Quais requisitos tratam autenticação de APIs?"*.
2. O Copiloto aciona `search_knowledge_base`, que recupera os requisitos mais relevantes (matriz Segura SD v4.1 e, quando habilitado, similaridade vetorial pgvector).
3. O Copiloto fundamenta a resposta com os requisitos recuperados (controle, criticidade, categoria, OWASP/STRIDE).
4. Na mesma conversa, o usuário pode **promover** qualquer requisito recuperado a um chamado com um comando (`create_kanban_ticket` + `requirement_code`).

> **Benefício:** a Base de Conhecimento deixa de ser apenas leitura e passa a alimentar ações concretas no ITSM dentro do fluxo conversacional.

---

## 4. Guia de Validação e Homologação

### 4.1 Pré-requisitos do ambiente

- Copiloto operacional (uma das chaves configuradas: `GROQ_API_KEY`, `OPENROUTER_API_KEY` ou `GEMINI_API_KEY`);
- Sessão autenticada no CyberITSM (as ferramentas exigem login);
- Acesso ao Kanban (`/dashboard`) para conferir os chamados criados/movidos.

### 4.2 Roteiro passo a passo (cenário obrigatório)

**Cenário 1 — Criação de chamado CRITICAL com requisito (Security QA → Kanban)**

1. Acesse o chat do Copiloto já autenticado.
2. Digite exatamente:
   > **"Crie um chamado de severidade CRITICAL para a falha no requisito VIVO.SEGURA.CRIP.01"**
3. **Esperado:**
   - O Copiloto aciona `create_kanban_ticket` (a ferramenta aparece na conversa como parte executada);
   - O chamado é criado no Kanban com:
     - Título coerente com a falha informada;
     - Descrição **enriquecida** com o conteúdo do requisito `VIVO.SEGURA.CRIP.01` (controle, detalhamento, riscos, OWASP/STRIDE);
     - Status `ABERTO`, prioridade `Crítica`, tags contendo `VIVO.SEGURA.CRIP.01`;
   - O Copiloto responde confirmando a criação, exibindo ID, título e status.
4. Verifique no `/dashboard` que o card apareceu na coluna **Aberto** e que a auditoria (`ticket_create`) foi registrada.

**Cenário 2 — Criação simples de chamado**

1. Digite: *"Abra um chamado de severidade HIGH: senha armazenada em texto plano no arquivo de configuração"*.
2. **Esperado:** chamado criado com prioridade `Alta`, status `ABERTO`, e confirmação com ID.

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

### 4.3 Matriz de aceite (checklist do analista/investidor)

| # | Critério de aceite | Resultado |
|---|---|---|
| A1 | Chamado CRITICAL + requisito criado com descrição enriquecida e tag do código | ☐ |
| A2 | Prioridade mapeada corretamente (CRITICAL→Crítica, HIGH→Alta, MEDIUM→Média, LOW→Baixa) | ☐ |
| A3 | Card criado visível no Kanban com status ABERTO | ☐ |
| A4 | Movimentação respeita máquina de estados; transição inválida retorna erro claro | ☐ |
| A5 | Perfil Solicitante bloqueado para mover cards (Matriz SoD) | ☐ |
| A6 | Busca da Base de Conhecimento retorna requisitos relevantes | ☐ |
| A7 | Pergunta informativa NÃO dispara ferramenta (fluxo de texto intacto) | ☐ |
| A8 | Sessão expirada/sem login → ferramenta orienta autenticação sem quebrar o chat | ☐ |
| A9 | Auditoria (`audit_logs`) registra criação/movimentação originada pelo Copiloto | ☐ |
| A10 | Nenhuma tela, rota ou funcionalidade pré-existente apresentou regressão | ☐ |

### 4.4 Rollback / Kill Switch (garantia de Risco Zero)

A funcionalidade é **totalmente aditiva e reversível**. Para restaurar o comportamento exato do pré-MCP:
1. Remova as 3 linhas de injeção em `app/api/chat/route.ts` (`createCopilotTools` / `tools` / `stopWhen`) e o bloco `MCP_TOOLS_GUIDANCE`;
2. Opcionalmente, remova o diretório `lib/mcp/` e a dependência `@modelcontextprotocol/sdk` do `package.json`.

Nenhuma outra alteração é necessária — não há migração de banco, variável obrigatória ou dependência infraestrutural para reverter.

---

## 5. Glossário Rápido

- **MCP (Model Context Protocol):** padrão aberto que padroniza como agentes de IA acessam ferramentas/recursos externos.
- **Tool (Ferramenta):** capacidade executável exposta ao modelo (criar/mover chamado, buscar requisito).
- **RAG (Retrieval-Augmented Generation):** geração de resposta fundamentada em recuperação de conhecimento.
- **Matriz SoD (Separation of Duties):** política RBAC do CyberITSM que separa poderes por perfil (admin/analista/solicitante).
- **Multi-step:** mecanismo do AI SDK que permite ao modelo executar uma ferramenta e, em seguida, produzir a resposta final com base no resultado.

---

*Documento técnico complementar: [Arquitetura MCP Local](../architecture/MCP_ARCHITECTURE.md).*
