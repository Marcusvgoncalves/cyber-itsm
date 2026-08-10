import { z } from 'zod';
import { createTicket, updateTicket } from '@/app/actions/tickets';
import { getRequirementByCode, searchKnowledgeBase, formatRequirement } from './knowledge-base';
import type { McpToolDefinition, McpToolResult } from './types';

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
    'Cria um novo chamado. O campo Épico é obrigatório. Se o usuário não informar o Épico,',
    'NÃO execute esta ferramenta. Em vez disso, use a ferramenta \'list_active_epics\' para buscar',
    'as opções disponíveis no sistema, apresente-as ao usuário no chat e pergunte qual ele deseja',
    'selecionar antes de prosseguir.',
    'Requer o título, a severidade (LOW, MEDIUM, HIGH ou CRITICAL) e o epic_id (Épico Pai ativo).',
    'Use o argumento "requirement_code" quando a falha estiver associada a um requisito',
    'da Base de Conhecimento (ex.: VIVO.SEGURA.CRIP.01) para enriquecer o chamado.',
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
      .string()
      .min(1)
      .max(64)
      .describe('ID (UUID) do Épico Pai ativo no Kanban. Use a ferramenta "list_active_epics" para obter as opções disponíveis.'),
    requirement_code: z
      .string()
      .max(64)
      .optional()
      .describe('Código do requisito da Base de Conhecimento (ex.: VIVO.SEGURA.CRIP.01).'),
  }),
  async execute(args, ctx) {
    if (!ctx.auth) {
      return errorResult(
        'Não foi possível abrir o chamado: é necessário estar autenticado na plataforma CyberITSM. Solicite o login e tente novamente.',
      );
    }

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
      .max(10)
      .optional()
      .describe('Quantidade de resultados desejada (padrão 5).'),
  }),
  async execute(args) {
    try {
      const results = await searchKnowledgeBase(args.query, args.limit ?? 5);

      if (results.length === 0) {
        return errorResult(
          `Nenhum requisito encontrado na Base de Conhecimento para "${args.query}". Considere reformular a busca ou consultar a matriz de requisitos no módulo Knowledge Base.`,
        );
      }

      const text = [
        `Resultados da Base de Conhecimento para "${args.query}" (${results.length}):`,
        ...results.map(
          (r, i) =>
            `${i + 1}. [${r.id ?? 'S/ID'}] ${r.controle ?? ''} — Criticidade: ${r.criticidade ?? 'N/A'} | Categoria: ${r.categoria ?? r.componente ?? 'N/A'} | OWASP: ${r.owasp ?? 'N/A'}`,
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
  async execute(args) {
    try {
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
];
