import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthService } from '@/lib/auth/authService';
import { listActiveEpics } from '@/lib/services/kanban';

/**
 * ============================================================================
 * API v1 — GET /api/v1/kanban/epics
 *
 * Lista os Épicos Pai ativos (type = EPICO, status não terminal) via Prisma.
 * Endpoint da transição silenciosa: consumido pelo MCP quando a Feature Flag
 * `USE_MICROSERVICES_API=true`. A autenticação usa a MESMA sessão do request
 * original (cookie reencaminhado pelo fetch interno do Copiloto).
 * ============================================================================
 */

export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: Request) {
  const auth = await getAuthService().getUser();
  if (!auth) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const parsed = QuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Parâmetros inválidos.', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const epics = await listActiveEpics(parsed.data.limit);
    return NextResponse.json({ success: true, count: epics.length, epics });
  } catch (err) {
    console.error('[api/v1] Falha ao listar Épicos:', err);
    return NextResponse.json({ error: 'Erro interno ao listar Épicos.' }, { status: 500 });
  }
}
