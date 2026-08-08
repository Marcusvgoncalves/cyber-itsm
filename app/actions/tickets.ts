"use server";

import { createClient } from "@/utils/supabase/server";
import { getAuthService } from "@/lib/auth/authService";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { notifyTicketCreated, notifyTicketUpdated } from "@/lib/email/notifications";
import {
  normalizePriority,
  isAllowedPriority,
  buildTicketChanges,
  validateTicketCreation,
  validateTicketUpdate,
  canCloseEpic,
} from "@/lib/domain/ticketRules";
import { DEFAULT_STATUSES, type Ticket, type TicketStatus, type User, type AuditLog } from "@/lib/types";
import { createAuditLog } from "@/lib/audit/audit";

export async function getTickets(): Promise<Ticket[]> {
  const supabase = await createClient();
  
  if (!(await getAuthService().verifySession())) return [];

  const isAdminOrAnalyst = await getAuthService().checkRole(['admin', 'analista']);

  let query = supabase
    .from('tickets')
    .select(`
      *,
      assignee_user:users_profiles!tickets_assignee_id_fkey(id, email, full_name, role, avatar_url),
      reporter:users_profiles!tickets_reporter_id_fkey(id, email, full_name, role, avatar_url)
    `)
    .order('created_at', { ascending: false });

  if (!isAdminOrAnalyst) {
    const context = await getAuthService().getUser();
    if (!context) return [];
    const currentUserId = context.session.id;
    query = query.or(`reporter_id.eq.${currentUserId},assignee_id.eq.${currentUserId}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  
  const ticketsList = (data || []).map((t: any) => ({
    ...t,
    type: t.type || 'TAREFA',
    status: (t.status ? t.status.toUpperCase() : 'ABERTO') as TicketStatus,
    assignee: t.assignee || t.assignee_user?.full_name || t.assignee_user?.email || 'Não atribuído',
    parentEpicId: t.parent_epic_id || t.parentEpicId || null,
    attachmentName: t.attachment_name || null,
    attachmentUrl: t.attachment_url || null,
    dueDate: t.due_date || null,
    sprintId: t.sprint_id || null,
  }));

  // Popula os títulos dos Épicos Pais nos objetos filhos
  const epicsMap = new Map<string, string>();
  ticketsList.forEach((t: Ticket) => {
    if (t.type === 'EPICO') {
      epicsMap.set(t.id, t.title);
    }
  });

  ticketsList.forEach((t: Ticket) => {
    if (t.parentEpicId && epicsMap.has(t.parentEpicId)) {
      t.parentEpic = { id: t.parentEpicId, title: epicsMap.get(t.parentEpicId)! };
    }
  });

  // Popula as sprints associadas (lookup único para evitar N+1)
  const sprintIds = [...new Set(ticketsList.map((t: Ticket) => t.sprintId).filter(Boolean))] as string[];
  if (sprintIds.length > 0) {
    const { data: sprints } = await supabase
      .from('sprints')
      .select('*')
      .in('id', sprintIds);
    const sprintsMap = new Map((sprints || []).map((s: any) => [s.id, s]));
    ticketsList.forEach((t: Ticket) => {
      if (t.sprintId && sprintsMap.has(t.sprintId)) {
        t.sprint = sprintsMap.get(t.sprintId)!;
      }
    });
  }

  return ticketsList;
}

export async function getTicketById(id: string): Promise<Ticket | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      assignee_user:users_profiles!tickets_assignee_id_fkey(id, email, full_name, role, avatar_url),
      reporter:users_profiles!tickets_reporter_id_fkey(id, email, full_name, role, avatar_url),
      comments(
        *,
        author:users_profiles!comments_author_id_fkey(id, email, full_name, role, avatar_url)
      )
    `)
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }

  const ticket: Ticket = {
    ...data,
    type: data.type || 'TAREFA',
    status: (data.status ? data.status.toUpperCase() : 'ABERTO') as TicketStatus,
    assignee: data.assignee || data.assignee_user?.full_name || data.assignee_user?.email || 'Não atribuído',
    parentEpicId: data.parent_epic_id || data.parentEpicId || null,
    attachmentName: data.attachment_name || null,
    attachmentUrl: data.attachment_url || null,
    dueDate: data.due_date || null,
    sprintId: data.sprint_id || null,
  };

  if (ticket.parentEpicId) {
    const { data: parentData } = await supabase
      .from('tickets')
      .select('id, title')
      .eq('id', ticket.parentEpicId)
      .single();
    if (parentData) {
      ticket.parentEpic = parentData;
    }
  }

  if (ticket.sprintId) {
    const { data: sprintData } = await supabase
      .from('sprints')
      .select('*')
      .eq('id', ticket.sprintId)
      .single();
    if (sprintData) {
      ticket.sprint = sprintData;
    }
  }

  if (ticket.type === 'EPICO') {
    const { data: childrenData } = await supabase
      .from('tickets')
      .select('*')
      .eq('parent_epic_id', ticket.id);
    ticket.childTickets = (childrenData || []).map((c: any) => ({
      ...c,
      status: (c.status ? c.status.toUpperCase() : 'ABERTO') as TicketStatus,
    }));
  }

  return ticket;
}

export type TicketActionResult = Ticket | { error: string };

export async function createTicket(
  formData: Partial<Ticket> & { reporter_id: string }
): Promise<TicketActionResult> {
  const supabase = await createClient();

  try {
    const creationValidation = validateTicketCreation({
      type: formData.type,
      status: formData.status,
      assignee: formData.assignee,
      parentEpicId: formData.parentEpicId || formData.parent_epic_id,
    });

    if (!creationValidation.valid) {
      return { error: creationValidation.error ?? 'Falha ao criar o chamado. Validação de domínio falhou.' };
    }

    const ticketType = formData.type || 'TAREFA';
    const parentEpicId = (ticketType === 'ATIVIDADE' || ticketType === 'TAREFA')
      ? (formData.parentEpicId || formData.parent_epic_id || null)
      : null;

    const { data, error } = await supabase
      .from('tickets')
      .insert({
        title: formData.title,
        description: formData.description || null,
        type: ticketType,
        status: 'ABERTO',
        priority: normalizePriority(formData.priority || 'media'),
        assignee: formData.assignee!.trim(),
        parent_epic_id: parentEpicId,
        framework_origem: formData.framework_origem || null,
        assignee_id: formData.assignee_id || null,
        reporter_id: formData.reporter_id,
        tags: formData.tags || [],
        attachment_name: formData.attachmentName || null,
        attachment_url: formData.attachmentUrl || null,
        due_date: formData.dueDate || null,
        sprint_id: formData.sprintId || null,
      })
      .select(`
        *,
        assignee_user:users_profiles!tickets_assignee_id_fkey(id, email, full_name, role, avatar_url),
        reporter:users_profiles!tickets_reporter_id_fkey(id, email, full_name, role, avatar_url)
      `)
      .single();

    if (error) {
      console.error('Erro do banco de dados ao criar chamado:', error);
      return { error: `Falha ao criar o chamado. Detalhes do banco de dados: ${error.message}` };
    }

    const newTicket: Ticket = {
      ...data,
      type: data.type || ticketType,
      status: (data.status ? data.status.toUpperCase() : 'ABERTO') as TicketStatus,
      assignee: data.assignee || formData.assignee,
      parentEpicId: data.parent_epic_id || parentEpicId,
      attachmentName: data.attachment_name,
      attachmentUrl: data.attachment_url,
      dueDate: data.due_date || null,
      sprintId: data.sprint_id || null,
    };

    if (newTicket.parentEpicId) {
      const { data: parentData } = await supabase
        .from('tickets')
        .select('id, title')
        .eq('id', newTicket.parentEpicId)
        .single();
      if (parentData) {
        newTicket.parentEpic = parentData;
      }
    }

    try {
      await notifyTicketCreated(newTicket);
    } catch (emailErr) {
      console.error('Falha ao enviar notificação de criação:', emailErr);
    }

    await createAuditLog('ticket_create', 'tickets', newTicket.id, null, {
      title: newTicket.title,
      type: newTicket.type,
      priority: newTicket.priority,
      status: newTicket.status,
    });

    revalidatePath('/dashboard');
    return newTicket;
  } catch (err) {
    console.error('Erro inesperado ao criar chamado:', err);
    return {
      error: err instanceof Error
        ? `Falha ao criar o chamado. ${err.message}`
        : 'Falha ao criar o chamado. Detalhes do banco de dados.',
    };
  }
}

export async function updateTicket(id: string, updates: Partial<Ticket>): Promise<TicketActionResult> {
  const supabase = await createClient();

  // FASE 2 / SANEAMENTO SOD: Validação rigorosa de Matriz SoD (RBAC).
  // Apenas perfis 'admin' e 'analista' possuem a permissão 'tickets:all'.
  // O perfil 'solicitante' tem permissão apenas de leitura/abertura, não podendo alterar chamados no Kanban.
  const canManage = await getAuthService().checkRole(['admin', 'analista']);
  if (!canManage) {
    return { error: 'Movimento bloqueado! O perfil Solicitante não possui permissão para alterar o status ou editar chamados (Matriz SoD).' };
  }

  try {
    const { data: previous, error: fetchErr } = await supabase
      .from('tickets')
      .select('id, title, type, status, priority, assignee, parent_epic_id, assignee_id, attachment_url')
      .eq('id', id)
      .single();

    if (fetchErr || !previous) {
      return { error: 'Chamado não encontrado.' };
    }

    const prevStatus = (previous.status ? previous.status.toUpperCase() : 'ABERTO') as TicketStatus;
    const updateValidation = validateTicketUpdate(
      { type: previous.type, status: prevStatus },
      { type: updates.type, status: updates.status ? updates.status.toUpperCase() : undefined }
    );

    if (!updateValidation.valid) {
      return { error: updateValidation.error ?? 'Falha ao atualizar o chamado. Validação de domínio falhou.' };
    }

    const newStatus = updates.status ? (updates.status.toUpperCase() as TicketStatus) : prevStatus;

    // Guardrail de fechamento de Épicos
    if (previous.type === 'EPICO' && newStatus === 'FECHADO') {
      const { data: children } = await supabase
        .from('tickets')
        .select('id, status')
        .eq('parent_epic_id', id);

      const childTickets = (children || []).map((c: any) => ({
        status: (c.status ? c.status.toUpperCase() : 'ABERTO') as TicketStatus,
      }));

      const epicGuardrail = canCloseEpic(childTickets);
      if (!epicGuardrail.allowed) {
        return { error: epicGuardrail.reason ?? 'Um Épico não pode ser fechado com itens filhos em aberto.' };
      }
    }

    const sanitized: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) sanitized.title = updates.title;
    if (updates.description !== undefined) sanitized.description = updates.description;
    if (updates.status !== undefined) sanitized.status = newStatus;
    if (updates.priority !== undefined && isAllowedPriority(updates.priority)) sanitized.priority = updates.priority;
    if (updates.assignee !== undefined && updates.assignee.trim()) sanitized.assignee = updates.assignee.trim();
    if (updates.tags !== undefined) sanitized.tags = updates.tags;
    if (updates.assignee_id !== undefined) sanitized.assignee_id = updates.assignee_id;
    if (updates.attachmentName !== undefined) sanitized.attachment_name = updates.attachmentName;
    if (updates.attachmentUrl !== undefined) sanitized.attachment_url = updates.attachmentUrl;
    if (updates.dueDate !== undefined) sanitized.due_date = updates.dueDate || null;
    if (updates.sprintId !== undefined) sanitized.sprint_id = updates.sprintId || null;

    const parentEpicVal = updates.parentEpicId !== undefined ? updates.parentEpicId : updates.parent_epic_id;
    if (parentEpicVal !== undefined) {
      sanitized.parent_epic_id = parentEpicVal || null;
    }

    // Se o anexo foi substituído ou removido, exclui o arquivo anterior do Storage
    const prevAttachmentUrl = previous.attachment_url;
    const newAttachmentUrl = sanitized.attachment_url;

    if (prevAttachmentUrl && prevAttachmentUrl !== newAttachmentUrl) {
      try {
        await supabase.storage
          .from('qa-temp-evidences')
          .remove([prevAttachmentUrl]);
      } catch (err) {
        console.error('[Storage/Cleanup] Falha ao excluir arquivo do chamado:', err);
      }
    }

    const { data, error } = await supabase
      .from('tickets')
      .update(sanitized)
      .eq('id', id)
      .select(`
        *,
        assignee_user:users_profiles!tickets_assignee_id_fkey(id, email, full_name, role, avatar_url),
        reporter:users_profiles!tickets_reporter_id_fkey(id, email, full_name, role, avatar_url)
      `)
      .single();

    if (error) {
      console.error('Erro do banco de dados ao atualizar chamado:', error);
      return { error: `Falha ao atualizar o chamado. Detalhes do banco de dados: ${error.message}` };
    }

    const updatedTicket: Ticket = {
      ...data,
      type: data.type || previous.type,
      status: (data.status ? data.status.toUpperCase() : newStatus) as TicketStatus,
      assignee: data.assignee || previous.assignee,
      parentEpicId: data.parent_epic_id || previous.parent_epic_id,
      attachmentName: data.attachment_name,
      attachmentUrl: data.attachment_url,
      dueDate: data.due_date || null,
      sprintId: data.sprint_id || null,
    };

    if (updatedTicket.parentEpicId) {
      const { data: parentData } = await supabase
        .from('tickets')
        .select('id, title')
        .eq('id', updatedTicket.parentEpicId)
        .single();
      if (parentData) {
        updatedTicket.parentEpic = parentData;
      }
    } else {
      updatedTicket.parentEpic = undefined;
    }

    const changes = buildTicketChanges(
      {
        status: prevStatus,
        priority: previous.priority,
        assigneeId: previous.assignee_id,
      },
      {
        status: updatedTicket.status,
        priority: updatedTicket.priority,
        assigneeId: updatedTicket.assignee_id || null,
        assigneeName: updatedTicket.assignee,
      }
    );

    if (changes.length > 0) {
      try {
        await notifyTicketUpdated(updatedTicket, changes);
      } catch (emailErr) {
        console.error('Falha ao enviar notificação de atualização:', emailErr);
      }
    }

    await createAuditLog('ticket_update', 'tickets', id, {
      status: prevStatus,
      priority: previous.priority,
    }, {
      status: updatedTicket.status,
      priority: updatedTicket.priority,
      assignee: updatedTicket.assignee,
    });

    revalidatePath('/dashboard');
    return updatedTicket;
  } catch (err) {
    console.error('Erro inesperado ao atualizar chamado:', err);
    return {
      error: err instanceof Error
        ? `Falha ao atualizar o chamado. ${err.message}`
        : 'Falha ao atualizar o chamado. Detalhes do banco de dados.',
    };
  }
}

export async function moveTicket(ticketId: string, newStatusId: string): Promise<void> {
  const supabase = await createClient();

  // FASE 2 / SANEAMENTO SOD: Validação rigorosa de Matriz SoD (RBAC).
  // Garante que apenas usuários autorizados (admin/analista) possam alterar status no Kanban.
  const canManage = await getAuthService().checkRole(['admin', 'analista']);
  if (!canManage) {
    throw new Error('Movimento bloqueado! O perfil Solicitante não possui permissão para alterar o status do chamado (Matriz SoD).');
  }

  const normalizedStatus = newStatusId.toUpperCase() as TicketStatus;

  const { data: previous, error: fetchErr } = await supabase
    .from('tickets')
    .select('id, type, status')
    .eq('id', ticketId)
    .single();

  if (fetchErr || !previous) {
    throw new Error('Chamado não encontrado.');
  }

  const prevStatus = (previous.status ? previous.status.toUpperCase() : 'ABERTO') as TicketStatus;
  const updateValidation = validateTicketUpdate(
    { type: previous.type, status: prevStatus },
    { status: normalizedStatus }
  );

  if (!updateValidation.valid) {
    throw new Error(updateValidation.error);
  }

  if (previous.type === 'EPICO' && normalizedStatus === 'FECHADO') {
    const { data: children } = await supabase
      .from('tickets')
      .select('id, status')
      .eq('parent_epic_id', ticketId);

    const childTickets = (children || []).map((c: any) => ({
      status: (c.status ? c.status.toUpperCase() : 'ABERTO') as TicketStatus,
    }));

    const epicGuardrail = canCloseEpic(childTickets);
    if (!epicGuardrail.allowed) {
      throw new Error(epicGuardrail.reason);
    }
  }

  const { error } = await supabase
    .from('tickets')
    .update({ status: normalizedStatus, updated_at: new Date().toISOString() })
    .eq('id', ticketId);

  if (error) throw new Error(error.message);

  await createAuditLog('ticket_move', 'tickets', ticketId, { status: prevStatus }, { status: normalizedStatus });

  revalidatePath('/dashboard');
}

export async function deleteTicket(id: string): Promise<void> {
  const supabase = await createClient();

  // Matriz SoD: exclusão de atividades do Kanban é exclusiva do perfil ADMIN.
  const context = await getAuthService().getUser();
  if (!context) throw new Error('Não autenticado.');
  if (context.user.role !== 'admin') {
    throw new Error('Acesso negado. Apenas usuários ADMIN podem excluir atividades do Kanban (Matriz SoD).');
  }

  // 1. Busca o ticket para auditoria + exclusão física do anexo
  const { data: ticket } = await supabase
    .from('tickets')
    .select('title, attachment_url')
    .eq('id', id)
    .single();

  if (ticket?.attachment_url) {
    try {
      await supabase.storage
        .from('qa-temp-evidences')
        .remove([ticket.attachment_url]);
    } catch (err) {
      console.error('[Storage/Cleanup] Falha ao excluir arquivo no expurgo do chamado:', err);
    }
  }

  // 2. Exclui do banco de dados
  const { error } = await supabase
    .from('tickets')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);

  await createAuditLog('ticket_delete', 'tickets', id, { title: ticket?.title }, null);

  revalidatePath('/dashboard');
}

export async function getStatuses() {
  return DEFAULT_STATUSES;
}

export async function getUsers(): Promise<User[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users_profiles')
    .select('*')
    .order('full_name', { ascending: true });
  
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getCurrentUser(): Promise<User | null> {
  const context = await getAuthService().getUser();
  return context?.user ?? null;
}

export async function getAuditLogs(limit = 100): Promise<AuditLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      *,
      user:users_profiles!audit_logs_user_id_fkey(id, email, full_name, role, avatar_url)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) throw new Error(error.message);
  return data || [];
}