import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthService } from '@/lib/auth/authService';
import {
  ServiceError,
  createTicket,
  createTicketSchema,
  listTickets,
  type Severity,
} from '@/lib/services/kanban';

/**
 * ============================================================================
 * API v1 — /api/v1/kanban/tickets
 *
 * - GET  : lista chamados (type = TAREFA) com filtros opcionais;
 * - POST : cria um chamado via Prisma (espelho da Server Action legada).
 *
 * Endpoints da transição silenciosa: consumidos pelo MCP quando a Feature Flag
 * `USE_MICROSERVICES_API=true`. A autenticação usa a MESMA sessão do request
 * original (cookie reencaminhado pelo fetch interno do Copiloto).
 * ============================================================================
 */

export const dynamic = 'force-dynamic';

const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.string().trim().min(1).optional(),
});

export async function GET(request: Request) {
  const auth = await getAuthService().getUser();
  if (!auth) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const parsed = ListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Parâmetros inválidos.', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const tickets = await listTickets({
      limit: parsed.data.limit,
      status: parsed.data.status,
    });
    return NextResponse.json({ success: true, count: tickets.length, tickets });
  } catch (err) {
    console.error('[api/v1] Falha ao listar chamados:', err);
    return NextResponse.json({ error: 'Erro interno ao listar chamados.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await getAuthService().getUser();
  if (!auth) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Corpo da requisição inválido (JSON esperado).' }, { status: 400 });
  }

  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Payload inválido.', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const ticket = await createTicket({
      title: parsed.data.title,
      description: parsed.data.description,
      severity: parsed.data.severity as Severity,
      epicId: parsed.data.epic_id,
      requirementCode: parsed.data.requirement_code,
      userId: auth.user.id,
      reporterId: auth.session.id,
      userFullName: auth.user.full_name,
      userEmail: auth.user.email,
    });

    return NextResponse.json({ success: true, ticket }, { status: 201 });
  } catch (err) {
    if (err instanceof ServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[api/v1] Falha ao criar chamado:', err);
    return NextResponse.json({ error: 'Erro interno ao criar o chamado.' }, { status: 500 });
  }
}
