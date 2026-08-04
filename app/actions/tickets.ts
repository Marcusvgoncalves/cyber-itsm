"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Ticket, TicketStatus, User, AuditLog } from "@/lib/types";

const VALID_PRIORITIES = ['baixa', 'media', 'alta', 'critica'];

export async function getTickets(): Promise<Ticket[]> {
  const supabase = await createClient();
  
  // Get current user to filter by permissions
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get user profile for role
  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdminOrAnalyst = profile?.role === 'admin' || profile?.role === 'analista';

  let query = supabase
    .from('tickets')
    .select(`
      *,
      assignee:users_profiles!tickets_assignee_id_fkey(id, email, full_name, role, avatar_url),
      reporter:users_profiles!tickets_reporter_id_fkey(id, email, full_name, role, avatar_url)
    `)
    .order('created_at', { ascending: false });

  // If not admin/analyst, only show tickets they created or are assigned to
  if (!isAdminOrAnalyst) {
    query = query.or(`reporter_id.eq.${user.id},assignee_id.eq.${user.id}`);
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
      priority: VALID_PRIORITIES.includes(formData.priority) ? formData.priority : 'media',
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
  
  revalidatePath('/dashboard/kanban');
  return data;
}

export async function updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket> {
  const supabase = await createClient();

  const sanitized: Record<string, unknown> = { ...updates };
  if (updates.priority !== undefined && !VALID_PRIORITIES.includes(updates.priority)) {
    delete sanitized.priority;
  }

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;
  
  const { data, error } = await supabase
    .from('users_profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  if (error) return null;
  return data;
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