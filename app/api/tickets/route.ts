import { NextResponse } from 'next/server';
import { getAuthService } from '@/lib/auth/authService';
import { createTicket } from '@/app/actions/tickets';
import { validateTicketCreation } from '@/lib/domain/ticketRules';
import type { TicketPriority, FrameworkOrigem, TicketType } from '@/lib/types';

/**
 * POST /api/tickets
 *
 * Cria um novo chamado e valida as regras de negócio hierárquicas
 * (Épico/Atividade/Tarefa), obrigatoriedade do Responsável e status ABERTO.
 */
export async function POST(request: Request) {
  const authenticated = await getAuthService().verifySession();
  if (!authenticated) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const context = await getAuthService().getUser();
  if (!context) {
    return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
  }

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

  const type = (typeof body.type === 'string' ? body.type.toUpperCase() : 'TAREFA') as TicketType;
  const assignee = typeof body.assignee === 'string' ? body.assignee.trim() : '';
  const parentEpicId = typeof body.parentEpicId === 'string' ? body.parentEpicId : (typeof body.parent_epic_id === 'string' ? body.parent_epic_id : null);

  const validation = validateTicketCreation({
    type,
    status: 'ABERTO',
    assignee,
    parentEpicId,
  });

  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const result = await createTicket({
      title,
      description: typeof body.description === 'string' ? body.description : null,
      type,
      status: 'ABERTO',
      priority: (typeof body.priority === 'string' ? body.priority : 'media') as TicketPriority,
      assignee,
      parentEpicId,
      parent_epic_id: parentEpicId,
      framework_origem: typeof body.framework_origem === 'string' ? (body.framework_origem as FrameworkOrigem) : null,
      assignee_id: typeof body.assignee_id === 'string' ? body.assignee_id : null,
      reporter_id: context.session.id,
      tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
    });

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao criar chamado.' }, { status: 400 });
  }
}