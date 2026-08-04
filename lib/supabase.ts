import { createClient } from '@/utils/supabase/server';
import type { Ticket, Status, Comment, User, AuditLog, TicketStatus, TicketPriority } from '@/lib/types';

export async function getStatuses(): Promise<Status[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ticket_statuses')
    .select('*')
    .order('position', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

export async function getTickets(filters?: {
  status?: TicketStatus;
  assignee_id?: string;
  reporter_id?: string;
  framework_origem?: string;
}): Promise<Ticket[]> {
  const supabase = await createClient();
  let query = supabase
    .from('tickets')
    .select(`
      *,
      assignee:users_profiles!tickets_assignee_id_fkey(id, email, full_name, role, avatar_url),
      reporter:users_profiles!tickets_reporter_id_fkey(id, email, full_name, role, avatar_url)
    `)
    .order('created_at', { ascending: false });
  
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.assignee_id) query = query.eq('assignee_id', filters.assignee_id);
  if (filters?.reporter_id) query = query.eq('reporter_id', filters.reporter_id);
  if (filters?.framework_origem) query = query.eq('framework_origem', filters.framework_origem);
  
  const { data, error } = await query;
  if (error) throw error;
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
    throw error;
  }
  return data;
}

export async function createTicket(ticket: Omit<Ticket, 'id' | 'created_at' | 'updated_at' | 'closed_at' | 'assignee' | 'reporter' | 'comments'> & { reporter_id: string }): Promise<Ticket> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tickets')
    .insert(ticket)
    .select(`
      *,
      assignee:users_profiles!tickets_assignee_id_fkey(id, email, full_name, role, avatar_url),
      reporter:users_profiles!tickets_reporter_id_fkey(id, email, full_name, role, avatar_url)
    `)
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateTicket(id: string, updates: Partial<Ticket>): Promise<Ticket> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tickets')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(`
      *,
      assignee:users_profiles!tickets_assignee_id_fkey(id, email, full_name, role, avatar_url),
      reporter:users_profiles!tickets_reporter_id_fkey(id, email, full_name, role, avatar_url)
    `)
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteTicket(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('tickets')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export async function getComments(ticketId: string): Promise<Comment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('comments')
    .select(`
      *,
      author:users_profiles!comments_author_id_fkey(id, email, full_name, role, avatar_url)
    `)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

export async function createComment(comment: Omit<Comment, 'id' | 'created_at' | 'updated_at' | 'author'>): Promise<Comment> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('comments')
    .insert(comment)
    .select(`
      *,
      author:users_profiles!comments_author_id_fkey(id, email, full_name, role, avatar_url)
    `)
    .single();
  
  if (error) throw error;
  return data;
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

export async function getUsers(): Promise<User[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users_profiles')
    .select('*')
    .order('full_name', { ascending: true });
  
  if (error) throw error;
  return data || [];
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
  
  if (error) throw error;
  return data || [];
}

export async function createStatus(status: Omit<Status, 'id' | 'created_at' | 'updated_at'>): Promise<Status> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ticket_statuses')
    .insert(status)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateStatus(id: string, updates: Partial<Status>): Promise<Status> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('ticket_statuses')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteStatus(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('ticket_statuses')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export async function reorderStatuses(statuses: { id: string; position: number }[]): Promise<void> {
  const supabase = await createClient();
  const updates = statuses.map(s => 
    supabase.from('ticket_statuses').update({ position: s.position, updated_at: new Date().toISOString() }).eq('id', s.id)
  );
  
  await Promise.all(updates);
}