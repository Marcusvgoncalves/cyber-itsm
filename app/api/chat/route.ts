import { streamText, type ModelMessage } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import requisitos from '../../../requisitos-sd.json';

// ============================================================================
// PROVEDOR ATIVO: Google Gemini (gemini-flash-latest)
// Modelo leve e gratuito dentro das quotas do plano Free do Google AI Studio.
// Variável de ambiente obrigatória: GOOGLE_GENERATIVE_AI_API_KEY
// ============================================================================
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const MODEL_ID = 'gemini-flash-latest'; // alias rolante do flash mais recente (modelos fixos 1.5/2.5 foram descontinuados)

// ============================================================================
// PROVEDOR LOCAL (OLLAMA) - COMENTADO
// Para rodar o agente 100% localmente via Ollama.
// O Docker precisa estar de pé com o modelo baixado:
//
//   docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
//   docker exec ollama ollama pull phi3   # ou: llama3
//
// import { createOpenAI } from '@ai-sdk/openai';
//
// const openai = createOpenAI({
//   apiKey: process.env.OLLAMA_API_KEY ?? 'ollama',
//   baseURL: 'http://localhost:11434/v1', // endpoint compatível com OpenAI do Ollama
// });
//
// const MODEL_ID = 'phi3'; // alternativa leve: 'llama3'
// const PROVIDER = openai;
// ============================================================================

const SYSTEM_PROMPT = `Você é um Assistente de Arquitetura de Cibersegurança especializado em ITSM e na Base de Requisitos de Arquitetura Segura SD v4.1. Responda baseando-se ESTRITAMENTE nos dois contextos fornecidos: [CONTEXTO DO CHAMADO] e [BASE DE CONHECIMENTO DE FRAMEWORKS]. REGRAS: 1. Responda com máxima assertividade e precisão técnica. 2. Sem saudações ou jargões. 3. Se a informação não estiver nos contextos, responda APENAS: 'Informação não encontrada no contexto atual.' 4. Formate a saída em tópicos curtos. 5. REGRA IMPORTANTE: responda de forma COMPLETA e exaustiva, cobrindo TODOS os requisitos relevantes da base, sem truncar. 6. Quando aplicável, cite o ID do requisito (ex.: VIVO.SEGURA.*), o componente, a categoria, a criticidade e a evidência/como testar da base de conhecimento. 7. Além de analisar chamados, você é o GUIA DO SISTEMA. Se o usuário perguntar como fazer algo na plataforma (ex: 'como abro um chamado?', 'onde vejo as métricas?'), explique de forma curta, em bullet points, o passo a passo na interface. 8. Regra de prioridade: quando a pergunta for de USO/NAVEGAÇÃO da plataforma (passo a passo na interface), priorize responder como guia do sistema, sem citar IDs de requisitos da base. 9. Toda resposta no MODO GUIA deve terminar com a seção 'Sugestões:' na última linha, listando 2 perguntas de acompanhamento (follow-up) curtas, uma por linha, começando com o caractere '#' (ex.: # Como troco a prioridade do chamado?). Esta seção é usada pela interface para renderizar chips de próximo passo.`;

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

/**
 * Recupera os requisitos mais relevantes da base SD v4.1 para a pergunta,
 * com base em correspondência de palavras-chave (RAG simplificado por BM25-aprox).
 */
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

function retrieveRelevantRequisitos(question: string, context: string, limit = 6): Requisito[] {
  const queryTokens = [...tokenize(question), ...tokenize(context)];

  const scored = (requisitos as unknown as Requisito[]).map((req) => {
    // Campos com maior peso têm mais relevância para o matching.
    const weighted = {
      core: [req.controle, req.componente, req.id, req.owasp, req.strideLM],
      detail: [req.detalhamento, req.riscos, req.categoria, req.propriedade],
      light: [req.criticidade, req.propriedade],
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

function formatRequerimento(req: Requisito): string {
  return [
    `[${req.id ?? 'S/ID'}] ${req.controle ?? ''}`,
    `  Detalhamento: ${req.detalhamento ?? 'N/A'}`,
    `  Componente: ${req.componente ?? 'N/A'} | Propriedade: ${req.propriedade ?? req.categoria ?? 'N/A'}`,
    `  STRIDE: ${req.strideLM ?? 'N/A'} | OWASP: ${req.owasp ?? 'N/A'}`,
    `  Riscos: ${req.riscos ?? 'N/A'}`,
    `  Categoria: ${req.categoria ?? 'N/A'} | Criticidade: ${req.criticidade ?? 'N/A'} | Tipo: ${req.tipoControle ?? 'N/A'}`,
  ].join('\n');
}

/**
 * Sanitiza a string de entrada: remove espaços duplicados/iniciais/finais e
 * descarta quaisquer caracteres de controle que possam ser usados para
 * injeção de prompt. Mantém apenas caracteres imprimíveis seguros de texto.
 */
function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Concatena o contexto do chamado, a base de conhecimento recuperada (RAG) e
 * a pergunta na mensagem final do usuário.
 */
function buildUserMessage(
  userMessage: string,
  ticketContext: string,
  relevantRequisitos: Requisito[]
): string {
  const cleanContext = sanitizeText(ticketContext);
  const contextSection = cleanContext
    ? `Contexto do Chamado: ${cleanContext}. `
    : '';

  let baseSection = '';
  if (relevantRequisitos.length > 0) {
    const formatted = relevantRequisitos.map(formatRequerimento).join('\n\n');
    baseSection = `\n\n[BASE DE CONHECIMENTO DE FRAMEWORKS - REQUISITOS RELEVANTES]\n${formatted}\n[FIM DA BASE DE CONHECIMENTO]`;
  }

  return `Contexto do Chamado: ${cleanContext}.${baseSection}\n\nPergunta: ${userMessage}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const ticketContext = sanitizeText(body?.ticketContext);

    if (rawMessages.length === 0) {
      return Response.json(
        { error: 'Nenhuma mensagem fornecida.' },
        { status: 400 }
      );
    }

    // Monta o histórico final: mantém todo o diálogo, mas injeta o contexto do
    // chamado + base de conhecimento na última mensagem do usuário.
    const history: ModelMessage[] = [];
    let lastUserQuestion = '';

    for (let i = 0; i < rawMessages.length; i++) {
      const m = rawMessages[i];
      const isLast = i === rawMessages.length - 1;
      
      // Handle both formats (content as string or parts array)
      let textContent = '';
      if (typeof m.content === 'string') {
        textContent = m.content;
      } else if (m.parts && Array.isArray(m.parts)) {
        const textPart = m.parts.find((p: any) => p.type === "text");
        textContent = textPart?.text ?? "";
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

    const result = streamText({
      model: google(MODEL_ID),
      system: SYSTEM_PROMPT,
      messages: history,
      // Valores seguros para reduzir custo e latência no modelo leve.
      temperature: 0.2,
      maxOutputTokens: 4096,
    });

    // Retorna a resposta em streaming no formato consumido pelo useChat.
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('[chat] erro no agente de contexto:', error);
    return Response.json(
      { error: 'Erro interno ao processar a análise do chamado.' },
      { status: 500 }
    );
  }
}