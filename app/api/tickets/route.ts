import { NextResponse } from 'next/server';
import { getAuthService } from '@/lib/auth/authService';
import { createTicket } from '@/lib/supabase';
import { notifyTicketCreated } from '@/lib/email/notifications';
import { normalizePriority } from '@/lib/domain/ticketRules';
import type { TicketPriority, FrameworkOrigem, TicketStatus } from '@/lib/types';

/**
 * POST /api/tickets
 *
 * Cria um novo chamado e dispara a notificação transacional de e-mail de forma
 * ASSÍNCRONA (fire-and-forget), garantindo que o envio NÃO bloqueie a resposta
 * da API principal.
 */
export async function POST(request: Request) {
  // 1. Autenticação via serviço (Adapter) — nunca via provedor concreto.
  const authenticated = await getAuthService().verifySession();
  if (!authenticated) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const context = await getAuthService().getUser();
  if (!context) {
    return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
  }

  // 2. Parse do corpo.
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return NextResponse.json({ error: 'O campo "title" é obrigatório.' }, { status: 400 });
  }

  const priority = normalizePriority(
    typeof body.priority === 'string' ? body.priority : 'media'
  );
  const status = (typeof body.status === 'string'
    ? body.status
    : 'aberto') as TicketStatus;

  // 3. Persistência (camada de dados).
  const ticket = await createTicket({
    title,
    description: typeof body.description === 'string' ? body.description : null,
    status,
    priority: priority as TicketPriority,
    framework_origem:
      typeof body.framework_origem === 'string'
        ? (body.framework_origem as FrameworkOrigem)
        : null,
    dominio_framework:
      typeof body.dominio_framework === 'string' ? body.dominio_framework : null,
    assignee_id: typeof body.assignee_id === 'string' ? body.assignee_id : null,
    reporter_id: context.session.id,
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
    compliance_frameworks: Array.isArray(body.compliance_frameworks)
      ? (body.compliance_frameworks as string[])
      : [],
  });

  // 4. Disparo ASSÍNCRONO (não aguardado — não trava a resposta).
  notifyTicketCreated(ticket);

  return NextResponse.json(ticket, { status: 201 });
}