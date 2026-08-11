import { z } from 'zod';
import { createTicket, updateTicket } from '@/app/actions/tickets';
import { getRequirementByCode, searchKnowledgeBase, formatRequirement } from './knowledge-base';
import type { McpToolDefinition, McpToolResult, McpExecutionContext } from './types';

/**
 * ============================================================================
 * MCP LOCAL — Registro de ferramentas (Tools) conectadas ao ITSM.
 *
 * Cada ferramenta é uma implementação pura e isolada que:
 *   - Valida TODOS os inputs com Zod (higienização de dados);
 *   - Aplica RBAC / Matriz SoD antes de qualquer escrita;
 *   - Reutiliza as rotas de domínio JÁ testadas em produção
 *     (`createTicket`, `updateTicket`) para manter notificações, trilha de
 *     auditoria, máquina de estados e revalidação do Kanban intactas;
 *   - Nunca lança exceções para o modelo — devolve `isError` controlado.
 *
 * Módulo ADITIVO. Não altera nenhuma rota/funcionalidade existente.
 * ============================================================================
 */

const SEVERITY_ENUM = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Severity = (typeof SEVERITY_ENUM)[number];

const TICKET_STATUS_ENUM = ['ABERTO', 'EM_ANDAMENTO', 'BLOQUEADO', 'FECHADO', 'CANCELADO'] as const;

/** Mapeia a severidade MCP para a prioridade nativa do Kanban. */
const SEVERITY_TO_PRIORITY: Record<Severity, 'baixa' | 'media' | 'alta' | 'critica'> = {
  LOW: 'baixa',
  MEDIUM: 'media',
  HIGH: 'alta',
  CRITICAL: 'critica',
};

function errorResult(message: string): McpToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function successResult(
  text: string,
  structuredContent?: Record<string, unknown>,
): McpToolResult {
  return {
    content: [{ type: 'text', text }],
    structuredContent,
  };
}

/**
 * ============================================================================
 * FEATURE FLAG: MICROSERVIÇOS / API v1 (transição silenciosa)
 *
 * Quando `USE_MICROSERVICES_API=true`, `list_active_epics` e
 * `create_kanban_ticket` deixam de acessar o domínio no mesmo processo e
 * passam a chamar as rotas HTTP internas em `/api/v1/...` via `fetch()` —
 * primeiro passo da extração do monólito (API Gateway/BFF).
 *
 *   - Sessão: o header `Cookie` do request original é reencaminhado, então a
 *     rota interna autentica com a MESMA sessão (nenhuma superfície nova);
 *   - Base: origin do request original (fallback: NEXT_PUBLIC_APP_URL ou
 *     http://localhost:3000);
 *   - Falha de rede/deploy: a ferramenta devolve `isError` controlado (não
 *     lança exceção para o modelo).
 * ============================================================================
 */

/** Lê a Feature Flag em runtime (`USE_MICROSERVICES_API=true`). */
function isMicroservicesApiEnabled(): boolean {
  return process.env.USE_MICROSERVICES_API === 'true';
}

/** Base absoluta para os fetches internos da Feature Flag. */
function internalApiBaseUrl(ctx: McpExecutionContext): string {
  return ctx.origin ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

/** Reencaminha a sessão do request original para as rotas `/api/v1`. */
function internalApiHeaders(ctx: McpExecutionContext): Record<string, string> {
  return ctx.cookies ? { Cookie: ctx.cookies } : {};
}

/**
 * Lista Épicos ativos via GET /api/v1/kanban/epics.
 * Paridade de mensagens com a implementação legada (`fetchActiveEpics`).
 */
async function fetchActiveEpicsViaApi(
  ctx: McpExecutionContext,
  limit: number,
): Promise<McpToolResult> {
  try {
    const res = await fetch(
      `${internalApiBaseUrl(ctx)}/api/v1/kanban/epics?limit=${limit}`,
      { headers: internalApiHeaders(ctx), cache: 'no-store' },
    );
    const data = await res.json();

    if (!res.ok) {
      return errorResult(
        `Não foi possível listar os Épicos via API v1: ${data?.error ?? res.statusText}`,
      );
    }

    if (data.epics.length === 0) {
      return errorResult(
        'Nenhum Épico ativo encontrado no Kanban. Crie um Épico antes de abrir chamados ou informe o Épico manualmente.',
      );
    }

    const text = [
      `Épicos ativos no Kanban (${data.count}):`,
      ...data.epics.map(
        (e: { id: string; title: string; status: string }, i: number) =>
          `${i + 1}. ${e.title} (ID: ${e.id}) — ${e.status}`,
      ),
      'Pergunte ao usuário qual Épico ele deseja selecionar antes de criar o chamado.',
    ].join('\n');

    return successResult(text, {
      success: true,
      count: data.count,
      epics: data.epics,
    });
  } catch (err) {
    console.error('[MCP] Falha ao listar Épicos via API v1:', err);
    return errorResult(
      'Não foi possível listar os Épicos via API neste momento. Tente novamente.',
    );
  }
}

interface CreateTicketViaApiArgs {
  title: string;
  description?: string;
  severity: Severity;
  epic_id: string;
  requirement_code?: string;
}

/**
 * Cria um chamado via POST /api/v1/kanban/tickets.
 * A validação do Épico é feita pela rota (devolve 404 com mensagem amigável).
 */
async function createTicketViaApi(
  ctx: McpExecutionContext,
  args: CreateTicketViaApiArgs,
): Promise<McpToolResult> {
  try {
    const res = await fetch(`${internalApiBaseUrl(ctx)}/api/v1/kanban/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...internalApiHeaders(ctx),
      },
      body: JSON.stringify({
        title: args.title,
        description: args.description,
        severity: args.severity,
        epic_id: args.epic_id,
        requirement_code: args.requirement_code,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      return errorResult(
        `Não foi possível criar o chamado via API v1: ${data?.error ?? res.statusText}`,
      );
    }

    const ticket = data.ticket;
    const epicId = ticket.epic?.id ?? args.epic_id;
    const epicTitle = ticket.epic?.title ?? epicId;

    return successResult(
      `Chamado criado com sucesso via API v1: "${ticket.title}" (ID ${ticket.id}), vinculado ao Épico "${epicTitle}" (${epicId}), status ${ticket.status}, prioridade ${ticket.priority}, severidade ${args.severity}.`,
      { success: true, ticket },
    );
  } catch (err) {
    console.error('[MCP] Falha ao criar chamado via API v1:', err);
    return errorResult(
      'Não foi possível criar o chamado via API neste momento. Tente novamente.',
    );
  }
}

/** Épicos considerados ativos (não fechados nem cancelados). */
const ACTIVE_EPIC_STATUSES = ['ABERTO', 'EM_ANDAMENTO', 'BLOQUEADO'] as const;

interface ActiveEpic {
  id: string;
  title: string;
  status: string;
}

/**
 * Consulta os Épicos Pai ativos diretamente na tabela `tickets` (type = EPICO)
 * via Prisma. O client do Prisma é carregado LAZY (mesmo padrão da camada
 * pgvector) para não acoplar o carregamento do módulo à conexão do pool.
 */
async function fetchActiveEpics(limit: number): Promise<ActiveEpic[]> {
  const [{ prisma }, { TicketType }] = await Promise.all([
    import('@/lib/security-qa/prisma'),
    import('@/lib/generated/prisma/enums'),
  ]);

  const rows = await prisma.ticket.findMany({
    where: {
      type: TicketType.EPICO,
      status: { in: [...ACTIVE_EPIC_STATUSES] },
    },
    select: { id: true, title: true, status: true },
    orderBy: { title: 'asc' },
    take: Math.max(1, Math.min(100, limit)),
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
  }));
}

/** Busca um único Épico ativo por ID (usado na criação para validar o vínculo). */
async function findActiveEpicById(epicId: string): Promise<ActiveEpic | null> {
  const [{ prisma }, { TicketType }] = await Promise.all([
    import('@/lib/security-qa/prisma'),
    import('@/lib/generated/prisma/enums'),
  ]);

  const row = await prisma.ticket.findFirst({
    where: {
      id: epicId,
      type: TicketType.EPICO,
      status: { in: [...ACTIVE_EPIC_STATUSES] },
    },
    select: { id: true, title: true, status: true },
  });

  return row ? { id: row.id, title: row.title, status: row.status } : null;
}

/**
 * Helper que infere o tipo dos argumentos a partir do `inputSchema` Zod,
 * garantindo `execute` tipada (args validados e com autocompletar).
 */
function defineTool<ArgsSchema extends z.ZodTypeAny>(
  definition: McpToolDefinition<ArgsSchema>,
): McpToolDefinition<ArgsSchema> {
  return definition;
}

/**
 * Ferramenta `create_kanban_ticket`
 * Abre um chamado no Kanban com título, descrição, severidade e, opcionalmente,
 * o código do requisito da Base de Conhecimento (que enriquece a descrição).
 */
const createKanbanTicket = defineTool({
  name: 'create_kanban_ticket',
  title: 'Abrir Chamado no Kanban',
  description: [
    'Cria um novo chamado. ATENÇÃO: O parâmetro epic_id é OBRIGATÓRIO e DEVE SER UM UUID VÁLIDO.',
    'REGRA CRÍTICA: Você ESTÁ PROIBIDO de \'adivinhar\' um Épico ou escolher um sozinho.',
    'Se o usuário pedir para criar um chamado e não disser explicitamente o nome de qual Épico',
    'ele quer usar, VOCÊ NÃO PODE CHAMAR ESTA FERRAMENTA. Você tem a obrigação de abortar a criação,',
    'rodar a ferramenta \'list_active_epics\', mostrar a lista pro usuário no chat e dizer:',
    '\'Em qual destes Épicos devo vincular?\'. Só chame o \'create_kanban_ticket\' DEPOIS que ele responder.',
  ].join(' '),
  inputSchema: z.object({
    title: z
      .string()
      .min(3, 'O título do chamado deve ter ao menos 3 caracteres.')
      .max(200)
      .describe('Título objetivo e curto do chamado (issue).'),
    description: z
      .string()
      .max(4000)
      .optional()
      .describe('Detalhamento do problema, evidências ou contexto da falha.'),
    severity: z
      .enum(SEVERITY_ENUM)
      .describe('Severidade do problema: LOW, MEDIUM, HIGH ou CRITICAL.'),
    epic_id: z
      .uuid('O parâmetro epic_id é obrigatório e deve ser um UUID válido.')
      .describe('ID (UUID) do Épico Pai ativo no Kanban. Obrigatório. Obtenha SEMPRE via "list_active_epics" — nunca adivinhe ou invente o ID.'),
    requirement_code: z
      .string()
      .max(64)
      .optional()
      .describe('Código do requisito da Base de Conhecimento (ex.: CYBER.SEGURA.CRIP.01).'),
  }),
  async execute(args, ctx) {
    if (!ctx.auth) {
      return errorResult(
        'Não foi possível abrir o chamado: é necessário estar autenticado na plataforma CyberITSM. Solicite o login e tente novamente.',
      );
    }

    // ===== FEATURE FLAG: MICROSERVIÇOS / API v1 (transição silenciosa) =====
    // Quando habilitada, o domínio é acessado via HTTP (/api/v1/kanban/tickets)
    // em vez da Server Action no mesmo processo.
    if (isMicroservicesApiEnabled()) {
      return await createTicketViaApi(ctx, {
        title: args.title,
        description: args.description,
        severity: args.severity,
        epic_id: args.epic_id,
        requirement_code: args.requirement_code,
      });
    }
    // ===== FIM DA FEATURE FLAG =====

    // 0) Épico Pai é obrigatório pela regra de negócio — valida existência e
    //    estado ativo ANTES de qualquer escrita, evitando erro de FK obscuro.
    const epic = await findActiveEpicById(args.epic_id);
    if (!epic) {
      return errorResult(
        'Não foi possível criar o chamado: o Épico informado não existe ou não está ativo no Kanban. Use a ferramenta "list_active_epics" para ver as opções disponíveis e informe o "epic_id" correto.',
      );
    }

    const severity = args.severity as Severity;
    const priority = SEVERITY_TO_PRIORITY[severity];

    // 1) Enriquecimento via Base de Conhecimento (RAG) quando há requirement_code.
    let enrichedDescription = args.description?.trim() ?? '';
    let requirementFound = false;

    if (args.requirement_code) {
      const requirement = getRequirementByCode(args.requirement_code);
      if (requirement) {
        requirementFound = true;
        enrichedDescription = [
          enrichedDescription,
          '',
          `Requisito de referência (Base de Conhecimento): ${args.requirement_code}`,
          formatRequirement(requirement),
        ].filter(Boolean).join('\n');
      } else {
        enrichedDescription = `${enrichedDescription}\n\n[Requisito "${args.requirement_code}" não localizado na Base de Conhecimento — tratado como código livre.]`.trim();
      }
    }

    const reporter = ctx.auth.session;
    const assigneeName =
      ctx.auth.user.full_name?.trim() || ctx.auth.user.email || reporter.email;

    // 2) Reutiliza a Server Action testada em produção (validação de domínio,
    //    máquina de estados, notificações, auditoria e revalidação do Kanban).
    const result = await createTicket({
      title: args.title.trim(),
      description: enrichedDescription || null,
      type: 'TAREFA',
      status: 'ABERTO',
      priority,
      parentEpicId: epic.id,
      assignee: assigneeName,
      assignee_id: ctx.auth.user.id,
      reporter_id: reporter.id,
      tags: ['mcp', 'copiloto', ...(args.requirement_code ? [args.requirement_code] : [])],
      framework_origem: null,
    });

    if ('error' in result) {
      return errorResult(`Não foi possível criar o chamado: ${result.error}`);
    }

    const ticket = result;
    return successResult(
      `Chamado criado com sucesso: "${ticket.title}" (ID ${ticket.id}), vinculado ao Épico "${epic.title}" (${epic.id}), status ${ticket.status}, prioridade ${ticket.priority}, severidade ${severity}.${requirementFound ? ' Associado ao requisito ' + args.requirement_code + '.' : ''}`,
      {
        success: true,
        ticket: {
          id: ticket.id,
          title: ticket.title,
          status: ticket.status,
          priority: ticket.priority,
          severity,
          epic: { id: epic.id, title: epic.title },
          requirement_code: args.requirement_code ?? null,
          assignee: assigneeName,
          url: '/dashboard',
        },
      },
    );
  },
});

/**
 * Ferramenta `move_kanban_card`
 * Move um card do Kanban para um novo status, respeitando a máquina de estados
 * e a Matriz SoD (apenas ADMIN/ANALISTA podem alterar status de chamados).
 */
const moveKanbanCard = defineTool({
  name: 'move_kanban_card',
  title: 'Mover Card do Kanban',
  description: [
    'Altera o status de um card (chamado) existente no Kanban do CyberITSM.',
    'Transições válidas: ABERTO -> EM_ANDAMENTO|CANCELADO;',
    'EM_ANDAMENTO -> FECHADO|BLOQUEADO|CANCELADO;',
    'BLOQUEADO -> EM_ANDAMENTO|CANCELADO; FECHADO -> ABERTO|EM_ANDAMENTO; CANCELADO é terminal.',
    'O perfil Solicitante NÃO possui permissão para mover cards (Matriz SoD).',
  ].join(' '),
  inputSchema: z.object({
    ticket_id: z.string().min(1).describe('ID (UUID) do chamado no Kanban.'),
    status: z
      .enum(TICKET_STATUS_ENUM)
      .describe('Novo status do card: ABERTO, EM_ANDAMENTO, BLOQUEADO, FECHADO ou CANCELADO.'),
  }),
  async execute(args, ctx) {
    if (!ctx.auth) {
      return errorResult(
        'Não foi possível mover o card: é necessário estar autenticado na plataforma CyberITSM.',
      );
    }

    // 2) RBAC rápido (mensagem amigável antes de acionar o domínio).
    if (ctx.auth.user.role === 'solicitante') {
      return errorResult(
        'Movimento bloqueado pela Matriz SoD: o perfil Solicitante não possui permissão para alterar o status de chamados no Kanban.',
      );
    }

    // 3) Delega à Server Action testada (valida transição, Épicos e auditoria).
    const result = await updateTicket(args.ticket_id, { status: args.status });

    if ('error' in result) {
      return errorResult(`Não foi possível mover o card: ${result.error}`);
    }

    const ticket = result;
    return successResult(
      `Card "${ticket.title}" (ID ${ticket.id}) movido com sucesso para o status "${ticket.status}".`,
      {
        success: true,
        ticket: {
          id: ticket.id,
          title: ticket.title,
          status: ticket.status,
          priority: ticket.priority,
        },
      },
    );
  },
});

/**
 * Ferramenta `search_knowledge_base`
 * Busca requisitos específicos na Base de Conhecimento (RAG) para que o agente
 * fundamente respostas e enriqueça chamados com contexto normativo.
 */
const searchKnowledgeBaseTool = defineTool({
  name: 'search_knowledge_base',
  title: 'Buscar Base de Conhecimento',
  description: [
    'Busca requisitos de segurança na Base de Conhecimento do CyberITSM',
    '(matriz de 314 Requisitos Segura SD v4.1 + RAG vetorial opcional).',
    'Use quando precisar identificar o requisito, controle, framework (OWASP/NIST),',
    'categoria ou criticidade relacionados a uma pergunta, falha ou laudo de Security QA.',
  ].join(' '),
  inputSchema: z.object({
    query: z
      .string()
      .min(2, 'Informe ao menos 2 caracteres para a busca.')
      .max(500)
      .describe('Pergunta ou termos sobre requisitos de segurança a pesquisar.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(3)
      .optional()
      .describe('Quantidade máxima de resultados (Top-K: 1 a 3, padrão 3).'),
  }),
  async execute(args) {
    try {
      const results = await searchKnowledgeBase(args.query, args.limit ?? 3);

      if (results.length === 0) {
        return errorResult(
          `Nenhum requisito encontrado na Base de Conhecimento para "${args.query}". Considere reformular a busca ou consultar a matriz de requisitos no módulo Knowledge Base.`,
        );
      }

      const text = [
        `Resultados da Base de Conhecimento para "${args.query}" (${results.length}):`,
        ...results.map(
          (r, i) =>
            `${i + 1}. [${r.requirement_code ?? 'S/ID'}] ${r.content ?? ''}`,
        ),
      ].join('\n');

      return successResult(text, {
        success: true,
        count: results.length,
        results,
      });
    } catch (err) {
      console.error('[MCP] Falha na busca da Base de Conhecimento:', err);
      return errorResult('Não foi possível consultar a Base de Conhecimento neste momento. Tente novamente.');
    }
  },
});

/**
 * Ferramenta `generate_security_assessment`
 * Gera um parecer de arquitetura e modelagem de ameaças (STRIDE) em Markdown.
 * O modelo coleta ameaças/requisitos (via search_knowledge_base) e entrega a
 * estrutura; a ferramenta devolve o artefato final para download no chat.
 */
const generateSecurityAssessment = defineTool({
  name: 'generate_security_assessment',
  title: 'Parecer de Arquitetura e Modelagem de Ameaças',
  description: [
    'Analisa a documentação ou descrição de um projeto, realiza modelagem de ameaças',
    '(metodologia STRIDE) e lista os requisitos de segurança exigidos.',
    'DEVE ser chamada quando o usuário pedir um parecer, relatório ou modelagem de projeto.',
  ].join(' '),
  inputSchema: z.object({
    project_context: z
      .string()
      .min(10, 'Forneça o contexto do projeto (descrição da arquitetura) com ao menos 10 caracteres.')
      .max(8000)
      .describe('Descrição do projeto/arquitetura analisada (componentes, fluxos, fronteiras de confiança).'),
    threats: z
      .array(
        z.object({
          title: z.string().min(1).max(200).describe('Título curto da ameaça identificada.'),
          description: z.string().min(1).max(2000).describe('Descrição da ameaça e do vetor de ataque.'),
          stride_category: z
            .enum([
              'SPOOFING',
              'TAMPERING',
              'REPUDIATION',
              'INFORMATION_DISCLOSURE',
              'DENIAL_OF_SERVICE',
              'ELEVATION_OF_PRIVILEGE',
            ])
            .describe('Categoria STRIDE da ameaça.'),
          severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).describe('Severidade da ameaça.'),
        }),
      )
      .min(1, 'Informe ao menos uma ameaça identificada.')
      .max(50),
    requirements: z
      .array(z.string().min(1).max(64))
      .min(1, 'Liste ao menos um código de requisito de segurança.')
      .max(50)
      .describe('Códigos dos requisitos da Base de Conhecimento (ex.: CYBER.SEGURA.CRIP.01).'),
    executive_summary: z
      .string()
      .min(10)
      .max(4000)
      .describe('Resumo executivo do parecer (postura de segurança e prioridades).'),
  }),
  async execute(args) {
    const markdown = [
      '# Parecer de Arquitetura e Modelagem de Ameaças',
      '',
      '## Resumo Executivo',
      args.executive_summary,
      '',
      '## Contexto do Projeto',
      args.project_context,
      '',
      '## Modelagem de Ameaças (STRIDE)',
      '',
      ...args.threats.map((t, i) => [
        `### ${i + 1}. ${t.title}`,
        '',
        `- **Categoria STRIDE:** ${t.stride_category.replace(/_/g, ' ').toLowerCase()}`,
        `- **Severidade:** ${t.severity}`,
        `- **Descrição:** ${t.description}`,
        '',
      ]),
      '## Requisitos de Segurança Exigidos',
      '',
      ...args.requirements.map((r) => `- \`${r}\``),
    ]
      .flat()
      .join('\n');

    return successResult(markdown, {
      success: true,
      markdown,
      counts: {
        threats: args.threats.length,
        requirements: args.requirements.length,
      },
    });
  },
});

/**
 * Ferramenta `list_active_epics`
 * Lista os Épicos Pai ativos do Kanban (type = EPICO, status não terminal).
 * Usada pelo agente para apresentar as opções ao usuário quando o Épico não
 * for informado, ANTES de executar `create_kanban_ticket` (campo obrigatório).
 */
const listActiveEpics = defineTool({
  name: 'list_active_epics',
  title: 'Listar Épicos Ativos',
  description: [
    'Lista os Épicos Pai ativos (ABERTO, EM_ANDAMENTO ou BLOQUEADO) do Kanban do CyberITSM.',
    'Use ANTES de "create_kanban_ticket" quando o usuário não informar o Épico: recupere as opções',
    '(id + título), apresente-as no chat e pergunte qual o usuário deseja selecionar.',
  ].join(' '),
  inputSchema: z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe('Quantidade máxima de épicos a retornar (padrão 20).'),
  }),
  async execute(args, ctx) {
    try {
      // ===== FEATURE FLAG: MICROSERVIÇOS / API v1 (transição silenciosa) =====
      if (isMicroservicesApiEnabled()) {
        return await fetchActiveEpicsViaApi(ctx, args.limit ?? 20);
      }
      // ===== FIM DA FEATURE FLAG =====

      const epics = await fetchActiveEpics(args.limit ?? 20);

      if (epics.length === 0) {
        return errorResult(
          'Nenhum Épico ativo encontrado no Kanban. Crie um Épico antes de abrir chamados ou informe o Épico manualmente.',
        );
      }

      const text = [
        `Épicos ativos no Kanban (${epics.length}):`,
        ...epics.map((e, i) => `${i + 1}. ${e.title} (ID: ${e.id}) — ${e.status}`),
        'Pergunte ao usuário qual Épico ele deseja selecionar antes de criar o chamado.',
      ].join('\n');

      return successResult(text, {
        success: true,
        count: epics.length,
        epics: epics.map((e) => ({ id: e.id, title: e.title, status: e.status })),
      });
    } catch (err) {
      console.error('[MCP] Falha ao listar Épicos ativos:', err);
      return errorResult('Não foi possível listar os Épicos neste momento. Tente novamente.');
    }
  },
});

/** Registro completo de ferramentas expostas pelo MCP local. */
export const mcpToolsRegistry: McpToolDefinition[] = [
  listActiveEpics,
  createKanbanTicket,
  moveKanbanCard,
  searchKnowledgeBaseTool,
  generateSecurityAssessment,
];
