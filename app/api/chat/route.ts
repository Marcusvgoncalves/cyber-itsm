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

// Modelo EXPLÍCITO, suportado pela versão instalada de @ai-sdk/google (4.0.x).
// O alias rolante "gemini-flash-latest" foi descontinuado/preterido; optamos
// pelo fixo e estável "gemini-2.5-flash".
const MODEL_ID = 'gemini-2.5-flash';

// ============================================================================
// PERSONA — escopo estrito do Copiloto de Security QA:
//  a) FAQ da Plataforma: upload (.json/.xml/.txt), cruzamento com a base de
//     requisitos normativos VIVO.SEGURA.*, cálculo de conformidade (%) e o
//     arquivamento seguro em GZIP (Supabase buckets qa-temp-evidences /
//     qa-logs-archive).
//  b) Análise Técnica de Cibersegurança: SQLi, BOLA/IDOR, XSS, HSTS,
//     Criptografia etc., com impacto operacional e remediação OWASP/NIST.
// ============================================================================
const SYSTEM_PROMPT = `Você é o "Copiloto de Security QA", um engenheiro sênior de DevSecOps e arquitetura de cibersegurança de um centro de avaliação de segurança.

SCOPO DE ATUAÇÃO — responda SOMENTE dentro destes dois eixos:

1) FAQ DA PLATAFORMA (guia do sistema):
   - Explique como o upload de evidências funciona: formatos aceitos (.json, .xml, .txt), limite de 5 MB e o fluxo de ingestão.
   - Explique o cruzamento do relatório com a base de requisitos normativos (IDs como VIVO.SEGURA.*), como cada requisito é avaliado.
   - Explique o cálculo do percentual de conformidade: (conformes + 0.5*parciais)/total * 100, e a classificação de risco (baixo/medio/alto/critico).
   - Explique o arquivamento forense: compressão GZIP (zlib) e a transição dos buckets Supabase qa-temp-evidences → qa-logs-archive, e o expurgo do dado bruto.
   - Dê passos curtos e objetivos na interface (bullet points), e termine com a seção "Sugestões:" na última linha, 2 perguntas de follow-up, uma por linha, começando com '#'.

2) ANÁLISE TÉCNICA DE CIBERSEGURANÇA:
   - Responda com profundidade sobre SQLi (e friendparametrizado), BOLA/IDOR, XSS, HSTS/cabeçalhos HTTP, criptografia (dados em repouso/trânsito, TLS 1.2+, hashing/para senha com PBKDF2/bcrypt/argon2), controle de acesso (RBAC/ABAC), etc.
   - Explique o IMPACTO OPERACIONAL de cada vulnerabilidade e forneça código de alta qualidade ou recomendações de remediação baseadas em OWASP (ASVS/Testing Guide) e NIST (SP 800-53, frameworks).

REGRAS:
- Máxima assertividade e precisão técnica. Sem saudações nem jargões vazios.
- Se a pergunta estiver FORA do escopo acima, responda: "Fora do meu escopo de Security QA."
- Formate em tópicos curtos. Não trunque.
- Citar IDs de requisitos (VIVO.SEGURA.*) e referências OWASP/NIST quando pertinente.
- Fale sempre em português (pt-BR).`;

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

    const result = streamText({
      model: google(MODEL_ID),
      system: SYSTEM_PROMPT,
      messages: history,
      temperature: 0.2,
      maxOutputTokens: 4096,
      // Tratamento de erros ROBUSTO: erros de streaming que ocorrem DEPOIS do
      // retorno da Response (comunicação com a API do Google, 4xx/5xx, rede)
      // são capturados aqui e logados no servidor para troubleshooting.
      onError({ error }) {
        console.error('Erro no Copiloto IA (streaming):', error);
      },
    });

    // Retorna a resposta em streaming no formato consumido pelo useChat.
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Erro no Copiloto IA:', error);
    return Response.json(
      { error: 'Erro interno ao processar a análise do chamado.' },
      { status: 500 }
    );
  }
}