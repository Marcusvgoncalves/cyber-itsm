import { streamText, convertToModelMessages, type ModelMessage } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// ============================================================================
// PROVEDOR ATIVO: Google Gemini (gemini-1.5-flash)
// Modelo leve e gratuito dentro das quotas do plano Free do Google AI Studio.
// Variável de ambiente obrigatória: GOOGLE_GENERATIVE_AI_API_KEY
// ============================================================================
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const MODEL_ID = 'gemini-1.5-flash';

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

const SYSTEM_PROMPT = `Você é um Assistente de Arquitetura de Cibersegurança especializado em ITSM. SUA ÚNICA FUNÇÃO é analisar o [CONTEXTO DO CHAMADO] e responder baseando-se ESTRITAMENTE nele. REGRAS: 1. Responda com máxima assertividade e precisão técnica. 2. Sem saudações ou jargões. 3. Se a informação não estiver no contexto, responda APENAS: 'Informação não encontrada no contexto atual.' 4. Formate a saída em tópicos curtos.`;

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
 * Concatena o contexto do chamado à última mensagem do usuário.
 * Ex.: "Contexto do Chamado: {ticketContext}. Pergunta: {userMessage}"
 */
function buildUserMessage(userMessage: string, ticketContext: string): string {
  const cleanContext = sanitizeText(ticketContext);
  const contextSection = cleanContext
    ? `Contexto do Chamado: ${cleanContext}. `
    : '';
  return `${contextSection}Pergunta: ${userMessage}`;
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
    // chamado na última mensagem do usuário em vez da pergunta em texto puro.
    const history: ModelMessage[] = [];
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

      if (isLast && m.role === 'user') {
        history.push({
          role: 'user',
          content: buildUserMessage(textContent, ticketContext),
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
      maxOutputTokens: 1024,
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