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
const MODEL_ID = 'gemini-1.5-flash';

// ============================================================================
// PERSONA — escopo estrito do Copiloto de Security QA:
//  a) FAQ da Plataforma: upload (.json/.xml/.txt), cruzamento com a base de
//     requisitos normativos VIVO.SEGURA.*, cálculo de conformidade (%) e o
//     arquivamento seguro em GZIP (Supabase buckets qa-temp-evidences /
//     qa-logs-archive).
//  b) Análise Técnica de Cibersegurança: SQLi, BOLA/IDOR, XSS, HSTS,
//     Criptografia etc., com impacto operacional e remediação OWASP/NIST.
// ============================================================================
const SYSTEM_PROMPT = `Você é o "Copiloto de Security QA", um engenheiro sênior de DevSecOps, IAM e arquitetura de cibersegurança do Centro de Security QA.

ESCOPO DE ATUAÇÃO — responda a perguntas organizadas nestes três eixos principais:

1) USO DO SISTEMA (Guia e FAQs do Portal):
   - Explique o uso geral do portal CyberITSM: navegação pelas abas de Dashboards, quadro Kanban de Chamados (fluxo de status: aberto, em andamento, em revisão, fechado, cancelado) e abertura de novos chamados.
   - Orientações sobre o Portal IAM/IGA: gestão de usuários do sistema, alteração de papéis (admin, analista, solicitante), reconfiguração de MFA/TOTP, ativação/desativação de contas e a fila de aprovações do Sailpoint.
   - Forneça passos curtos e objetivos (usando bullet points) quando guiar o usuário na interface do sistema. Termine obrigatoriamente respostas desse eixo com a seção "Sugestões:" na última linha contendo 2 perguntas de follow-up (iniciando com '#', uma por linha).

2) BASE DE REQUISITOS PARA PROJETOS (Adoção das Normas):
   - Esclareça dúvidas sobre quais controles e requisitos de segurança corporativos os projetos devem adotar com base na base de requisitos normativos VIVO.SEGURA.*.
   - Quando requisitos relevantes forem fornecidos no contexto da pergunta, explique detalhadamente o controle, o componente afetado, a propriedade STRIDE correspondente, os riscos associados e como realizar a implementação correta.
   - Recomende boas práticas de codificação segura e arquitetura para viabilizar a conformidade com a base normativa.

3) PROCESSO E RESULTADOS DE AVALIAÇÃO DE QA (Motor de Security QA):
   - Detalhe o pipeline de análise estática: upload da evidência bruta no bucket temporário (qa-temp-evidences, formatos JSON, XML ou TXT, limite de 5 MB), cruzamento com a base de requisitos, e o arquivamento forense.
   - Explique o processo de cold storage forense: compressão em GZIP (zlib nível 9), upload do arquivo .gz para o bucket persistente (qa-logs-archive), geração do URL assinado com validade de 7 dias, e o expurgo automático e seguro da evidência temporária.
   - Explique a fórmula de conformidade: (conformes + 0.5 * parciais) / total * 100, arredondado para uma casa decimal, e as classificações de risco (baixo: >= 85%, medio: 70-84%, alto: 50-69%, critico: < 50%).
   - Ajude no diagnóstico e remediação técnica de achados classificados como "não conforme" ou "parcial", fornecendo recomendações claras baseadas no OWASP (ASVS) e NIST SP 800-53.

REGRAS DE RESPOSTA:
- Máxima assertividade e precisão técnica. Sem saudações ou jargões vazios.
- Se a pergunta estiver FORA do escopo acima, responda: "Fora do meu escopo de Security QA."
- Formate em tópicos curtos e legíveis. Nunca trunque o texto.
- Citar os IDs dos requisitos (VIVO.SEGURA.*) e referências OWASP/NIST correspondentes sempre que apropriado.
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