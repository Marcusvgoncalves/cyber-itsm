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

export async function createTicket(formData: Partial<Ticket> & { reporter_id: string }): Promise<Ticket> {
  const supabase = await createClient();

  const creationValidation = validateTicketCreation({
    type: formData.type,
    status: formData.status,
    assignee: formData.assignee,
    parentEpicId: formData.parentEpicId || formData.parent_epic_id,
  });

  if (!creationValidation.valid) {
    throw new Error(creationValidation.error);
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
    })
    .select(`
      *,
      assignee_user:users_profiles!tickets_assignee_id_fkey(id, email, full_name, role, avatar_url),
      reporter:users_profiles!tickets_reporter_id_fkey(id, email, full_name, role, avatar_url)
    `)
    .single();

  if (error) throw new Error(error.message);

  const newTicket: Ticket = {
    ...data,
    type: data.type || ticketType,
    status: (data.status ? data.status.toUpperCase() : 'ABERTO') as TicketStatus,
    assignee: data.assignee || formData.assignee,
    parentEpicId: data.parent_epic_id || parentEpicId,
  };

  await notifyTicketCreated(newTicket);
  revalidatePath('/dashboard/kanban');
  return newTicket;
}

export async function updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket> {
  const supabase = await createClient();

  const { data: previous, error: fetchErr } = await supabase
    .from('tickets')
    .select('id, title, type, status, priority, assignee, parent_epic_id, assignee_id')
    .eq('id', id)
    .single();

  if (fetchErr || !previous) {
    throw new Error('Chamado não encontrado.');
  }

  const prevStatus = (previous.status ? previous.status.toUpperCase() : 'ABERTO') as TicketStatus;
  const updateValidation = validateTicketUpdate(
    { type: previous.type, status: prevStatus },
    { type: updates.type, status: updates.status ? updates.status.toUpperCase() : undefined }
  );

  if (!updateValidation.valid) {
    throw new Error(updateValidation.error);
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
      throw new Error(epicGuardrail.reason);
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

  if (error) throw new Error(error.message);

  const updatedTicket: Ticket = {
    ...data,
    type: data.type || previous.type,
    status: (data.status ? data.status.toUpperCase() : newStatus) as TicketStatus,
    assignee: data.assignee || previous.assignee,
    parentEpicId: data.parent_epic_id || previous.parent_epic_id,
  };

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
    await notifyTicketUpdated(updatedTicket, changes);
  }

  revalidatePath('/dashboard/kanban');
  return updatedTicket;
}

export async function moveTicket(ticketId: string, newStatusId: string): Promise<void> {
  const supabase = await createClient();
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

  revalidatePath('/dashboard/kanban');
}

export async function deleteTicket(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('tickets')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard/kanban');
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