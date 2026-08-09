import { isEmbeddableEngineEnabled } from '@/utils/featureFlags';
import { isApiRequestAuthorized } from '@/lib/embed/api-auth';
import { getQaResultById, listQaResults } from '@/lib/security-qa/qaRepository';

// ============================================================================
// API Externa v1 — Security QA (Motor Embarcável / API-First).
//
// Ordem OBRIGATÓRIA de validação:
//   1. Feature Flag (Kill Switch) — se OFF, 404 imediato;
//   2. API Key (header `x-api-key` = EXTERNAL_API_KEY) — se inválida, 401.
// Depois disso, executa a leitura dos laudos (somente leitura, zero escrita).
// ============================================================================

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/external/v1/security-qa
 * GET /api/external/v1/security-qa?id=<uuid>
 */
export async function GET(req: Request) {
  // 1) Kill Switch: estrutura nascida desligada.
  if (!isEmbeddableEngineEnabled()) {
    return Response.json({ error: 'Not Found' }, { status: 404 });
  }

  // 2) Validação de API Key logo após a Feature Flag.
  if (!isApiRequestAuthorized(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');

  try {
    if (id) {
      const result = await getQaResultById(id);
      if (!result) {
        return Response.json({ error: 'Laudo de Security QA não encontrado.' }, { status: 404 });
      }
      return Response.json(result);
    }

    const results = await listQaResults(50);
    return Response.json({ count: results.length, results });
  } catch (error) {
    console.error('[external/v1/security-qa] Erro ao listar laudos:', error);
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
