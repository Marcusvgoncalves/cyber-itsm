import { streamText, isStepCount, type LanguageModel, type ModelMessage, type ToolSet } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAI } from '@ai-sdk/openai';
import requisitos from '../../../requisitos-sd.json';
import { getAuthService } from '@/lib/auth/authService';
import type { AuthContext } from '@/lib/auth/types';
import { createCopilotTools } from '@/lib/mcp/adapter';

// ============================================================================
// COPILOTO DE IA GLOBAL — ESTEIRA MULTIAGENTE ENXUTA (Zero Downtime).
//
// Pipeline: useChat (@ai-sdk/react) → POST /api/chat → ROTEADOR DE AGENTES.
//
// Prioridade de execução:
//   1. SambaNova  → Meta-Llama-3.3-70B-Instruct (Primário — alta capacidade Free)
//   2. SambaNova  → Meta-Llama-3.1-8B-Instruct  (Secundário — Free)
//   3. OpenRouter → deepseek/deepseek-chat      (Fallback Pago 1)
//   4. OpenRouter → anthropic/claude-3-5-haiku-20241022 (Fallback Pago 2)
//
// Se um provedor gratuito atingir o limite de requisições (429), o roteador
// chaveia automaticamente para o próximo agente em milissegundos (try/catch
// encadeado com disparo EAGER da requisição via `result.response`).
//
// Tokens lidos ESTRITAMENTE do ambiente do processo (nunca fixados no código):
//   process.env.SAMBANOVA_API_KEY
//   process.env.OPENROUTER_API_KEY
// ============================================================================

// Lê a primeira chave de API válida dentre os nomes fornecidos. Retorna null se
// nenhuma estiver configurada (o agente é simplesmente ignorado pelo roteador).
function resolveApiKey(names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim() !== '' && !value.includes('your_')) {
      return value.trim();
    }
  }
  return null;
}

// Fábrica de modelos: (apiKey) => (modelId) => LanguageModel.
// Normaliza a assinatura dos provedores para permitir chamada uniforme no loop.
type ModelFactory = (apiKey: string) => (modelId: string) => LanguageModel;

const OPENROUTER: ModelFactory = (apiKey) => {
  const provider = createOpenRouter({ apiKey });
  return (modelId) => provider(modelId);
};

// SambaNova — Free Tier de alta capacidade (API compatível com OpenAI).
const SAMBANOVA: ModelFactory = (apiKey) => {
  const provider = createOpenAI({
    baseURL: 'https://api.sambanova.ai/v1',
    apiKey,
  });
  return (modelId) => provider(modelId);
};

interface AgentConfig {
  id: string;
  label: string;
  envKeys: string[];
  modelIds: string[];
  createModel: ModelFactory;
}

// Esteira enxuta de agentes em ordem de prioridade.
const AGENTS: AgentConfig[] = [
  // ── 1º Tier — Gratuito (Primário / Alta Capacidade) ────────────────────────
  {
    id: 'sambanova-70b',
    label: 'SambaNova (Meta Llama 3.3 70B Instruct)',
    envKeys: ['SAMBANOVA_API_KEY'],
    modelIds: ['Meta-Llama-3.3-70B-Instruct'],
    createModel: SAMBANOVA,
  },
  // ── 2º Tier — Gratuito (Secundário / Modelo Rápido) ────────────────────────
  {
    id: 'sambanova-8b',
    label: 'SambaNova (Meta Llama 3.1 8B Instruct)',
    envKeys: ['SAMBANOVA_API_KEY'],
    modelIds: ['Meta-Llama-3.1-8B-Instruct'],
    createModel: SAMBANOVA,
  },
  // ── 3º Tier — PAGO (Fallback 1 / OpenRouter) ───────────────────────────────
  {
    id: 'openrouter-deepseek',
    label: 'OpenRouter (DeepSeek V3)',
    envKeys: ['OPENROUTER_API_KEY'],
    modelIds: ['deepseek/deepseek-chat'],
    createModel: OPENROUTER,
  },
  // ── 4º Tier — PAGO (Fallback 2 / OpenRouter) ───────────────────────────────
  {
    id: 'openrouter-claude',
    label: 'OpenRouter (Claude 3.5 Haiku)',
    envKeys: ['OPENROUTER_API_KEY'],
    modelIds: ['anthropic/claude-3-5-haiku-20241022'],
    createModel: OPENROUTER,
  },
];

// ============================================================================
// PERSONA — System Instruction UNIFICADA injetada em todos os agentes.
// ============================================================================
const SYSTEM_PROMPT = `Você é o Copiloto de IA Global da plataforma CyberITSM, um Especialista Sênior em AppSec e DevSecOps.
ATENÇÃO: Você DEVE atuar ESTRITAMENTE dentro de contextos de segurança cibernética, tratamento de chamados (tickets), frameworks de mercado (NIST, CIS, OWASP) e processos de Security QA. Recuse educadamente qualquer pergunta fora deste escopo.
REGRA DE MODELAGEM DE AMEAÇAS E REQUISITOS: Ao analisar incidentes, código ou arquiteturas (STRIDE, MITRE), responda EXCLUSIVAMENTE em tópicos curtos (bullet points) conectando o vetor de ataque e o plano técnico de mitigação. Seja muito rápido, direto, e nunca utilize tabelas.
DIRETRIZ DE KANBAN: Você tem acesso a ferramentas de Kanban. Se o usuário pedir para criar um chamado de segurança e não informar o Épico (que é obrigatório), VOCÊ É PROIBIDO de perguntar cegamente. Você DEVE obrigatoriamente chamar a ferramenta 'list_active_epics' primeiro, ler os épicos disponíveis no sistema, e então listá-los no chat perguntando ao usuário qual ele prefere.
DIRETRIZ CRÍTICA DE ECONOMIA DE TOKENS: Você deve operar em modo de compressão de contexto. Elimine saudações, cordialidades, introduções e conclusões. Vá direto ao ponto. Ao gerar atividades, análises ou tarefas, seja estritamente objetivo. Nunca explique o que vai fazer, apenas entregue o artefato ou chame a tool correspondente.`;

// ============================================================================
// MCP LOCAL — Bloco de orientação para as ferramentas (aditivo).
// Instrui o modelo a acionar as Tools SOMENTE diante de intenção explícita do
// usuário em executar uma ação no ITSM. Sem intenção, o fluxo de texto normal
// permanece intacto.
// ============================================================================
const MCP_TOOLS_GUIDANCE = `VOCÊ POSSUI FERRAMENTAS MCP LOCAIS (Model Context Protocol) DISPONÍVEIS PARA AUTOMATIZAR AÇÕES NO ITSM. Acione-as SOMENTE quando o usuário demonstrar intenção explícita de EXECUTAR uma ação:
- list_active_epics: listar os Épicos Pai ativos do Kanban (id + título). Use SEMPRE ANTES de create_kanban_ticket quando o Épico não tiver sido informado, pois ele é um campo OBRIGATÓRIO (ver DIRETRIZ DE KANBAN no system prompt).
- create_kanban_ticket: abrir um chamado no Kanban. Parâmetros: title (título), description (descrição), severity (LOW, MEDIUM, HIGH ou CRITICAL), epic_id (ID do Épico Pai, OBRIGATÓRIO) e, opcionalmente, requirement_code (código do requisito da Base de Conhecimento, ex.: CYBER.SEGURA.CRIP.01).
- move_kanban_card: alterar o status de um card existente. Parâmetros: ticket_id (ID do chamado) e status (ABERTO, EM_ANDAMENTO, BLOQUEADO, FECHADO ou CANCELADO).
- search_knowledge_base: buscar requisitos na Base de Conhecimento para fundamentar respostas com contexto normativo (NIST, CIS, OWASP).
- generate_security_assessment: gerar um PARECER de arquitetura e modelagem de ameaças (STRIDE). DEVE ser chamada quando o usuário pedir um parecer, relatório ou modelagem de projeto. Use search_knowledge_base antes para obter os códigos de requisitos, monte o structured content (project_context, threats[], requirements[], executive_summary) e passe para a ferramenta — o resultado é entregue em Markdown para download.
Se o usuário apenas fizer perguntas, análises ou consultas SEM pedir para abrir/mover/alterar nada, responda em texto normal SEM acionar ferramentas. Antes de executar create_kanban_ticket, confirme com o usuário quando faltar informação essencial (ex.: severidade ou título). SE FALTAR O ÉPICO, NUNCA pergunte cegamente: chame 'list_active_epics' primeiro e apresente as opções (DIRETRIZ DE KANBAN).`;

interface Requisito {
  id: string | null;
  controle: string | null;
  detalhamento: string | null;
  componente: string | null;
  propriedade: string | null;
  strideLM: string | null;
  riscos: string | null;
  owasp: string | null;
  categoria: string | null;
  criticidade: string | null;
  tipoControle: string | null;
  evidencia: string | null;
  comoTestar: string | null;
}

const STOPWORDS = new Set([
  'qual', 'quais', 'como', 'para', 'que', 'com', 'uma', 'um', 'das', 'dos', 'da', 'de', 'do', 'em',
  'oque', 'pode', 'posso', 'me', 'mais', 'mas', 'por', 'na', 'no', 'se', 'sobre', 'quero', 'saber',
  'falar', 'especifica', 'aplicar', 'ser', 'esta', 'este', 'estao', 'voce', 'contexto', 'chamado',
]);

function tokenize(text: string): string[] {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const tokens = normalized.split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOPWORDS.has(t));
  return Array.from(new Set(tokens));
}

function retrieveRelevantRequisitos(question: string, context: string, limit = 2): Requisito[] {
  const queryTokens = [...tokenize(question), ...tokenize(context)];
  const scored = (requisitos as unknown as Requisito[]).map((req) => {
    const weighted = {
      core: [req.controle, req.componente, req.id, req.owasp, req.strideLM],
      detail: [req.detalhamento, req.riscos, req.categoria, req.propriedade],
      light: [req.criticidade],
    };
    let score = 0;
    for (const token of queryTokens) {
      if (weighted.core.some((f) => f && tokenize(f).includes(token))) score += 3;
      if (weighted.detail.some((f) => f && tokenize(f).includes(token))) score += 2;
      if (weighted.light.some((f) => f && tokenize(f).includes(token))) score += 1;
    }
    return { req, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.req);
}

/**
 * PODA DE TOKENS — trunca qualquer texto a um limite máximo de caracteres
 * (padrão 400) para impedir que conteúdos RAG gigantescos explodam o payload
 * e causem HTTP 413 (TPM Limit) nos provedores gratuitos.
 */
function clip(text: string | null | undefined, max = 400): string {
  if (!text) return 'N/A';
  const value = String(text).trim();
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function formatRequerimento(req: Requisito): string {
  return [
    `[${req.id ?? 'S/ID'}] ${clip(req.controle)}`,
    `  Detalhamento: ${clip(req.detalhamento, 400)}`,
    `  Componente: ${clip(req.componente)} | Propriedade: ${clip(req.propriedade ?? req.categoria)}`,
    `  STRIDE: ${clip(req.strideLM)} | OWASP: ${clip(req.owasp)}`,
    `  Riscos: ${clip(req.riscos, 400)}`,
    `  Categoria: ${clip(req.categoria)} | Criticidade: ${clip(req.criticidade)} | Tipo: ${clip(req.tipoControle)}`,
  ].join('\n');
}

function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function buildUserMessage(
  userMessage: string,
  ticketContext: string,
  relevantRequisitos: Requisito[]
): string {
  const cleanContext = sanitizeText(ticketContext);

  let baseSection = '';
  if (relevantRequisitos.length > 0) {
    const formatted = relevantRequisitos.map(formatRequerimento).join('\n\n');
    baseSection = `\n\n[BASE DE CONHECIMENTO DE FRAMEWORKS - REQUISITOS RELEVANTES]\n${formatted}\n[FIM DA BASE DE CONHECIMENTO]`;
  }

  return `Contexto do Chamado: ${cleanContext}.${baseSection}\n\nPergunta: ${userMessage}`;
}

// ============================================================================
// ROTEADOR MULTIAGENTE — fallback encadeado (try/catch) entre os provedores.
//
// O `streamResult.response` (Promise) dispara a requisição HTTP de forma EAGER,
// permitindo capturar 404/429/5xx ANTES de devolver o stream ao cliente e
// chavear imediatamente para o próximo agente da esteira.
// ============================================================================
type StreamResult = Awaited<ReturnType<typeof streamText>>;

async function routeToAvailableAgent(
  history: ModelMessage[],
  options: { system: string; tools?: ToolSet }
): Promise<{ result: StreamResult; agentLabel: string; modelId: string }> {
  const failures: string[] = [];

  for (const agent of AGENTS) {
    const apiKey = resolveApiKey(agent.envKeys);
    if (!apiKey) {
      failures.push(`${agent.label}: chave de API ausente`);
      continue;
    }

    const model = agent.createModel(apiKey);

    for (const modelId of agent.modelIds) {
      try {
        const result = streamText({
          model: model(modelId),
          system: options.system,
          messages: history,
          temperature: 0.2,
          maxOutputTokens: 4096,
          // MCP LOCAL (aditivo): injeta as ferramentas. Se o modelo não as
          // acionar, o fluxo de texto normal permanece intacto.
          tools: options.tools,
          // Habilita multi-step: permite ao modelo executar tools e, em
          // seguida, gerar a resposta final usando o resultado delas.
          // Sem tool calls, `stopWhen` não altera o comportamento padrão.
          stopWhen: isStepCount(5),
          // Erros de streaming que ocorrem DEPOIS do retorno da Response são
          // logados no servidor para troubleshooting.
          onError({ error }) {
            console.error('Erro no Copiloto IA (streaming):', error);
          },
        });

        // Dispara a requisição EAGER — lança se o provedor rejeitar (404/429/5xx).
        await result.response;

        console.log(`[Copiloto IA] Agente ativo: ${agent.label} (${modelId})`);
        return { result, agentLabel: agent.label, modelId };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failures.push(`${agent.label} (${modelId}): ${message}`);
        console.warn(
          `[Copiloto IA] Falha no agente "${agent.label}" (${modelId}): ${message}. Tentando próximo...`
        );
      }
    }
  }

  throw new Error(
    failures.length > 0
      ? failures.join(' | ')
      : 'Nenhum agente de IA configurado. Defina SAMBANOVA_API_KEY ou OPENROUTER_API_KEY.'
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const ticketContext = sanitizeText(body?.ticketContext);

    // PODA DE CONTEXTO / TOKEN LIMITING — envia apenas as últimas 5 mensagens
    // ao modelo. Histórico longo esgota a cota (TPM) rapidamente e causa
    // HTTP 413 no plano gratuito; o contexto do chamado + RAG são injetados
    // apenas na última mensagem do usuário.
    const historySource = rawMessages.slice(-5);

    if (historySource.length === 0) {
      return Response.json(
        { error: 'Nenhuma mensagem fornecida.' },
        { status: 400 }
      );
    }

    // Monta o histórico final: mantém o diálogo limitado, mas injeta o contexto
    // do chamado + base de conhecimento na última mensagem do usuário.
    const history: ModelMessage[] = [];
    let lastUserQuestion = '';

    for (let i = 0; i < historySource.length; i++) {
      const m = historySource[i];
      const isLast = i === historySource.length - 1;

      let textContent = '';
      if (typeof m.content === 'string') {
        textContent = m.content;
      } else if (m.parts && Array.isArray(m.parts)) {
        const textPart = m.parts.find((p: any) => p.type === 'text');
        textContent = textPart?.text ?? '';
      } else {
        textContent = String(m.content || '');
      }

      if (m.role === 'user') lastUserQuestion = textContent;

      if (isLast && m.role === 'user') {
        const relevant = retrieveRelevantRequisitos(lastUserQuestion, ticketContext);
        history.push({
          role: 'user',
          content: buildUserMessage(textContent, ticketContext, relevant),
        });
      } else {
        history.push({
          role: m.role as 'user' | 'assistant' | 'system',
          content: textContent,
        });
      }
    }

    // MCP LOCAL (aditivo) — Resolve a autenticação EAGERLY (antes do streaming)
    // e injeta as ferramentas via adaptador. Se o modelo não acionar nenhuma
    // tool, o fluxo de resposta em texto normal permanece 100% intacto.
    let authContext: AuthContext | null = null;
    try {
      authContext = await getAuthService().getUser();
    } catch {
      authContext = null;
    }
    const mcpTools = createCopilotTools(authContext, {
      // Reencaminha a sessão do request original aos fetches internos /api/v1.
      cookies: req.headers.get('cookie') ?? undefined,
      origin: new URL(req.url).origin,
    });
    const systemWithTools = `${SYSTEM_PROMPT}\n\n${MCP_TOOLS_GUIDANCE}`;

    const { result } = await routeToAvailableAgent(history, {
      system: systemWithTools,
      tools: mcpTools,
    });

    // Retorna a resposta em streaming no formato consumido pelo useChat.
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Erro no Copiloto IA:', error);

    const errMessage = error instanceof Error ? error.message : String(error);
    const isRateLimit =
      errMessage.includes('429') ||
      errMessage.toUpperCase().includes('RESOURCE_EXHAUSTED') ||
      errMessage.toLowerCase().includes('rate limit');

    if (isRateLimit) {
      const friendlyMessage = '⚠️ Todos os provedores gratuitos de IA atingiram o limite de requisições (429). Por favor, aguarde alguns instantes e tente novamente.';

      // Formata como um bloco de texto do protocolo de streaming da Vercel AI SDK (0:"texto"\n)
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`0:${JSON.stringify(friendlyMessage)}\n`));
          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Experimental-Stream-Data': 'true',
        },
      });
    }

    return Response.json(
      { error: 'Erro interno ao processar a análise do chamado.' },
      { status: 500 }
    );
  }
}
