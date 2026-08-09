import { isEmbeddableEngineEnabled } from '@/utils/featureFlags';
import { isApiRequestAuthorized } from '@/lib/embed/api-auth';
import { routeToModel } from '@/lib/llm/agent-router';

// ============================================================================
// API Externa v1 — LLM Proxy (Motor Embarcável / API-First).
//
// Ordem OBRIGATÓRIA de validação:
//   1. Feature Flag (Kill Switch) — se OFF, 404 imediato;
//   2. API Key (header `x-api-key` = EXTERNAL_API_KEY) — se inválida, 401.
// Depois disso, roteia o prompt pela esteira multiagente gratuita.
// ============================================================================

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  // 1) Kill Switch: estrutura nascida desligada.
  if (!isEmbeddableEngineEnabled()) {
    return Response.json({ error: 'Not Found' }, { status: 404 });
  }

  // 2) Validação de API Key logo após a Feature Flag.
  if (!isApiRequestAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return Response.json({ error: "Campo 'prompt' é obrigatório." }, { status: 400 });
  }

  const system = typeof body?.system === 'string' ? body.system : undefined;

  try {
    const { provider, model, response } = await routeToModel(prompt, system);
    return Response.json({ provider, model, response });
  } catch (error: any) {
    console.error('[external/v1/llm-proxy] Erro ao processar prompt:', error);
    return Response.json(
      { error: error?.message || 'Erro ao processar o prompt.' },
      { status: 502 }
    );
  }
}
