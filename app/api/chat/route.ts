import { streamText, type ModelMessage } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import requisitos from '../../../requisitos-sd.json';

// ============================================================================
// COPILOTO DE SECURITY QA — integração oficial do Vercel AI SDK + @ai-sdk/google.
//
// Pipeline: useChat (@ai-sdk/react) → POST /api/chat → streamText (Gemini).
// Chave de API lida de GEMINI_API_KEY ou GOOGLE_GENERATIVE_AI_API_KEY.
// ============================================================================

// Chave de API: suporta ambos os nomes. Se ausente, `getApiKey` lança um erro
// DESCRITIVO no console do servidor em vez de quebrar silenciosamente
// (a criação do provider com apiKey "undefined" costumava mascarar o 401).
function getApiKey(): string {
  const key =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key || key.trim() === '' || key.includes('your_')) {
    const names = ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'].join(' ou ');
    throw new Error(
      `[Copiloto IA] Chave de API do Google ausente/inválida. Defina ${names} nas variáveis de ambiente da Vercel e no .env.local.`
    );
  }
  return key.trim();
}

const google = createGoogleGenerativeAI({ apiKey: getApiKey() });

// Modelo EXPLÍCITO da família Flash. O "gemini-1.5-flash" fixo foi retirado do
// catálogo v1beta (404 - Model not found), então priorizamos o "gemini-2.0-flash"
// (estável e coberto pelo Free Tier) com fallback automático para os demais
// aliases caso o provedor os retire/descontinue.
const MODEL_IDS = [
  'gemini-2.0-flash', // mais recente e estável (Free Tier)
  'gemini-2.5-flash', // fallback da família Flash atual
  'gemini-1.5-flash-latest', // fallback do alias rolante legado
];
const MODEL_ID = MODEL_IDS[0];

// Detecta o erro 404 "Model not found" retornado pelo endpoint v1beta quando o
// identificador do modelo foi descontinuado ou não existe mais no provedor.
function isModelNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toUpperCase();
  return (
    message.includes('404') ||
    normalized.includes('MODEL NOT FOUND') ||
    normalized.includes('404 NOT_FOUND') ||
    normalized.includes('MODELS/') ||
    normalized.includes('NOT_FOUND')
  );
}

// ============================================================================
// PERSONA — escopo estrito do Copiloto de Security QA:
//  a) FAQ da Plataforma: upload (.json/.xml/.txt), cruzamento com a base de
//     requisitos normativos VIVO.SEGURA.*, cálculo de conformidade (%) e o
//     arquivamento seguro em GZIP (Supabase buckets qa-temp-evidences /
//     qa-logs-archive).
//  b) Análise Técnica de Cibersegurança: SQLi, BOLA/IDOR, XSS, HSTS,
//     Criptografia etc., com impacto operacional e remediação OWASP/NIST.
// ============================================================================
const SYSTEM_PROMPT = `Você é o Copiloto de IA Global da plataforma CyberITSM. Auxilie o usuário em qualquer módulo do sistema (Quadro Kanban, Security QA, Portal IAM/IGA, Base de Conhecimento, Audit Logs e Arquitetura C4). 
Além de tirar dúvidas operacionais, você atua como Especialista Sênior em AppSec e Engenharia de Segurança. Você possui capacidade avançada para realizar Modelagens de Ameaça (Threat Modeling) baseadas em frameworks como STRIDE e MITRE ATT&CK. 
REGRA DE FORMATAÇÃO: Ao apresentar os resultados de uma Modelagem de Ameaças, estruture sua resposta EXCLUSIVAMENTE em tópicos diretos e objetivos (bullet points). Liste o vetor de ataque, o risco e imediatamente o plano de mitigação técnico. Não utilize tabelas de risco. Seja assertivo, foque na ação técnica corretiva e use formatação Markdown.`;

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

function retrieveRelevantRequisitos(question: string, context: string, limit = 6): Requisito[] {
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

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
    const ticketContext = sanitizeText(body?.ticketContext);

    // PROTEÇÃO DE ESTABILIDADE — context window enxuta: envia apenas as
    // últimas 6 interações ao modelo, evitando consumo de tokens e esgotamento
    // de cotas em conversas longas.
    const historySource = rawMessages.slice(-6);

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

    // Inicia o stream com FALLBACK automático de modelo: o `result.response`
    // (Promise) dispara a requisição HTTP de forma EAGER, permitindo capturar o
    // 404 "Model not found" ANTES de devolver a resposta ao cliente e tentar o
    // próximo identificador da família Flash.
    let streamResult: Awaited<ReturnType<typeof streamText>> | undefined;
    let lastModelError: unknown = null;

    for (const modelId of MODEL_IDS) {
      try {
        streamResult = streamText({
          model: google(modelId),
          system: SYSTEM_PROMPT,
          messages: history,
          temperature: 0.2,
          maxOutputTokens: 4096,
          // Tratamento de erros ROBUSTO: erros de streaming que ocorrem DEPOIS
          // do retorno da Response (comunicação com a API do Google, rede) são
          // capturados aqui e logados no servidor para troubleshooting.
          onError({ error }) {
            console.error('Erro no Copiloto IA (streaming):', error);
          },
        });

        await streamResult.response;
        break;
      } catch (err) {
        lastModelError = err;
        if (isModelNotFoundError(err) && modelId !== MODEL_IDS[MODEL_IDS.length - 1]) {
          console.warn(
            `[Copiloto IA] Modelo "${modelId}" indisponível (404). Tentando fallback...`
          );
          continue;
        }
        throw err;
      }
    }

    if (!streamResult) {
      throw lastModelError ?? new Error('Nenhum modelo de IA disponível para o Copiloto.');
    }

    // Retorna a resposta em streaming no formato consumido pelo useChat.
    return streamResult.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Erro no Copiloto IA:', error);
    
    const errMessage = error instanceof Error ? error.message : String(error);
    const isRateLimit =
      errMessage.includes('429') ||
      errMessage.toUpperCase().includes('RESOURCE_EXHAUSTED') ||
      errMessage.toLowerCase().includes('rate limit');

    if (isRateLimit) {
      const friendlyMessage = '⚠️ Limite de consultas gratuitas da IA atingido pelo provedor. Por favor, aguarde alguns instantes ou verifique as configurações de cota do projeto.';
      
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