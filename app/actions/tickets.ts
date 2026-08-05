"use server";

import { createClient } from "@/utils/supabase/server";
import { getAuthService } from "@/lib/auth/authService";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { notifyTicketCreated, notifyTicketUpdated } from "@/lib/email/notifications";
import { normalizePriority, isAllowedPriority, buildTicketChanges } from "@/lib/domain/ticketRules";
import type { Ticket, TicketStatus, User, AuditLog } from "@/lib/types";

export async function getTickets(): Promise<Ticket[]> {
  const supabase = await createClient();
  
  // Valida a sessão pelo serviço de autenticação (Adapter).
  if (!(await getAuthService().verifySession())) return [];

  const isAdminOrAnalyst = await getAuthService().checkRole(['admin', 'analista']);

  let query = supabase
    .from('tickets')
    .select(`
      *,
      assignee:users_profiles!tickets_assignee_id_fkey(id, email, full_name, role, avatar_url),
      reporter:users_profiles!tickets_reporter_id_fkey(id, email, full_name, role, avatar_url)
    `)
    .order('created_at', { ascending: false });

  // Se não for admin/analista, exibe apenas chamados criados ou atribuídos ao usuário.
  if (!isAdminOrAnalyst) {
    const context = await getAuthService().getUser();
    if (!context) return [];
    const currentUserId = context.session.id;
    query = query.or(`reporter_id.eq.${currentUserId},assignee_id.eq.${currentUserId}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getTicketById(id: string): Promise<Ticket | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      assignee:users_profiles!tickets_assignee_id_fkey(id, email, full_name, role, avatar_url),
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
  return data;
}

export async function createTicket(formData: Omit<Ticket, 'id' | 'created_at' | 'updated_at' | 'closed_at' | 'assignee' | 'reporter' | 'comments'> & { reporter_id: string }): Promise<Ticket> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('tickets')
    .insert({
      title: formData.title,
      description: formData.description,
      status: formData.status,
      priority: normalizePriority(formData.priority),
      framework_origem: formData.framework_origem,
      dominio_framework: formData.dominio_framework,
      assignee_id: formData.assignee_id,
      reporter_id: formData.reporter_id,
      tags: formData.tags || [],
      compliance_frameworks: formData.compliance_frameworks || [],
    })
    .select(`
      *,
      assignee:users_profiles!tickets_assignee_id_fkey(id, email, full_name, role, avatar_url),
      reporter:users_profiles!tickets_reporter_id_fkey(id, email, full_name, role, avatar_url)
    `)
    .single();
  
  if (error) throw new Error(error.message);
  
  // Notificação assíncrona (fire-and-forget) — não bloqueia a resposta.
  notifyTicketCreated(data);

  revalidatePath('/dashboard/kanban');
  return data;
}

export async function updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket> {
  const supabase = await createClient();

  const sanitized: Record<string, unknown> = { ...updates };
  if (updates.priority !== undefined && !isAllowedPriority(updates.priority)) {
    delete sanitized.priority;
  }

  // Captura o estado anterior para compor a lista de alterações da notificação.
  const { data: previous } = await supabase
    .from('tickets')
    .select('title, status, priority, assignee_id')
    .eq('id', id)
    .single();

  const { data, error } = await supabase
    .from('tickets')
    .update({ ...sanitized, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(`
      *,
      assignee:users_profiles!tickets_assignee_id_fkey(id, email, full_name, role, avatar_url),
      reporter:users_profiles!tickets_reporter_id_fkey(id, email, full_name, role, avatar_url)
    `)
    .single();
  
  if (error) throw new Error(error.message);
  
  // Notificação assíncrona (fire-and-forget) — não bloqueia a resposta.
  if (previous) {
    const changes = buildTicketChanges(
      {
        status: previous.status,
        priority: previous.priority,
        assigneeId: previous.assignee_id,
      },
      {
        status: data.status,
        priority: data.priority,
        assigneeId: data.assignee_id,
        assigneeName: data.assignee?.full_name ?? data.assignee?.email ?? null,
      }
    );

    if (changes.length > 0) {
      notifyTicketUpdated(data, changes);
    }
  }

  revalidatePath('/dashboard/kanban');
  return data;
}

export async function moveTicket(ticketId: string, newStatusId: string): Promise<void> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('tickets')
    .update({ status: newStatusId, updated_at: new Date().toISOString() })
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ticket_statuses')
    .select('*')
    .order('position', { ascending: true });
  
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getUsers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users_profiles')
    .select('id, email, full_name, role, avatar_url')
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