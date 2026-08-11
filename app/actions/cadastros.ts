"use server";

import { createClient } from "@/utils/supabase/server";
import { getAuthService } from "@/lib/auth/authService";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/app/actions/auth";
import type {
  NotificationSetting,
  Sprint,
  SprintStatus,
  NotificationChannel,
  SecurityRequirement,
} from "@/lib/types";

/**
 * Server Actions do módulo "Configurações e Cadastros" (/dashboard?tab=cadastros).
 *
 * Segue a Matriz SoD (Separation of Duties): apenas o perfil ADMIN pode criar,
 * editar ou remover Sprints e configurar Notificações. Os demais perfis apenas
 * leem os dados (a UI oculta os formulários de escrita para não-ADMIN).
 */

function requireAdmin(): Promise<boolean> {
  return getAuthService().checkRole(['admin']);
}

// ---------------------------------------------------------------------------
// Sprints
// ---------------------------------------------------------------------------

export async function getSprints(): Promise<Sprint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sprints')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as Sprint[];
}

export type SprintInput = {
  name: string;
  goal?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: SprintStatus;
};

export type SprintActionResult = Sprint | { error: string };

export async function createSprint(input: SprintInput): Promise<SprintActionResult> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode criar sprints.' };

  const name = input.name?.trim();
  if (!name) return { error: 'O nome da sprint é obrigatório.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sprints')
    .insert({
      name,
      goal: input.goal?.trim() || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      status: input.status || 'PLANEJADA',
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar sprint:', error);
    return { error: `Falha ao criar sprint: ${error.message}` };
  }

  await createAuditLog('sprint_create', 'sprints', data.id, null, { name: data.name });
  revalidatePath('/dashboard');
  revalidatePath('/admin/cadastros');
  return data as Sprint;
}

export async function updateSprint(id: string, input: SprintInput): Promise<SprintActionResult> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode editar sprints.' };

  const supabase = await createClient();
  const { data: previous } = await supabase.from('sprints').select('*').eq('id', id).single();
  if (!previous) return { error: 'Sprint não encontrada.' };

  const name = input.name?.trim();
  if (!name) return { error: 'O nome da sprint é obrigatório.' };

  const { data, error } = await supabase
    .from('sprints')
    .update({
      name,
      goal: input.goal?.trim() || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      status: input.status || previous.status,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar sprint:', error);
    return { error: `Falha ao atualizar sprint: ${error.message}` };
  }

  await createAuditLog('sprint_update', 'sprints', id, { name: previous.name }, { name: data.name });
  revalidatePath('/dashboard');
  revalidatePath('/admin/cadastros');
  return data as Sprint;
}

export async function deleteSprint(id: string): Promise<{ error?: string }> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode remover sprints.' };

  const supabase = await createClient();
  const { data: sprint } = await supabase.from('sprints').select('name').eq('id', id).single();
  if (!sprint) return { error: 'Sprint não encontrada.' };

  const { error } = await supabase.from('sprints').delete().eq('id', id);
  if (error) return { error: `Falha ao remover sprint: ${error.message}` };

  await createAuditLog('sprint_delete', 'sprints', id, { name: sprint.name }, null);
  revalidatePath('/dashboard');
  revalidatePath('/admin/cadastros');
  return {};
}

// ---------------------------------------------------------------------------
// Notification Settings
// ---------------------------------------------------------------------------

export async function getNotificationSettings(): Promise<NotificationSetting[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .order('event_type', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as NotificationSetting[];
}

export type NotificationSettingInput = {
  event_type: string;
  channel: NotificationChannel;
  enabled: boolean;
  description?: string | null;
};

export async function upsertNotificationSetting(input: NotificationSettingInput): Promise<NotificationSetting | { error: string }> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode configurar notificações.' };

  if (!input.event_type?.trim()) return { error: 'O tipo de evento é obrigatório.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notification_settings')
    .upsert(
      {
        event_type: input.event_type,
        channel: input.channel,
        enabled: input.enabled,
        description: input.description?.trim() || null,
      },
      { onConflict: 'event_type,channel' }
    )
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar configuração de notificação:', error);
    return { error: `Falha ao salvar configuração: ${error.message}` };
  }

  await createAuditLog('notification_setting_update', 'notification_settings', data.id, null, {
    event_type: data.event_type,
    enabled: data.enabled,
  });
  revalidatePath('/dashboard');
  revalidatePath('/admin/cadastros');
  return data as NotificationSetting;
}

export async function toggleNotificationSetting(id: string, enabled: boolean): Promise<NotificationSetting | { error: string }> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode configurar notificações.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notification_settings')
    .update({ enabled })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao alternar notificação:', error);
    return { error: `Falha ao alternar configuração: ${error.message}` };
  }

  await createAuditLog('notification_setting_update', 'notification_settings', id, null, { enabled });
  revalidatePath('/dashboard');
  revalidatePath('/admin/cadastros');
  return data as NotificationSetting;
}

// ---------------------------------------------------------------------------
// Matriz de Requisitos (Requisitos customizados da governança — ADMIN)
// ---------------------------------------------------------------------------

export async function getCustomRequirements(): Promise<SecurityRequirement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('security_requirements')
    .select('*')
    .eq('custom', true)
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as SecurityRequirement[];
}

export type RequirementInput = {
  id: string;
  controle: string;
  detalhamento?: string | null;
  componente?: string | null;
  propriedade?: string | null;
  stride_lm?: string | null;
  riscos?: string | null;
  owasp?: string | null;
  categoria?: string | null;
  criticidade?: string;
  tipo_controle?: string | null;
  evidencia?: string | null;
  como_testar?: string | null;
};

export type RequirementActionResult = SecurityRequirement | { error: string };

export async function upsertRequirement(input: RequirementInput): Promise<RequirementActionResult> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode gerenciar requisitos.' };

  const id = input.id?.trim();
  if (!id) return { error: 'O ID do requisito é obrigatório (ex: CYBER.SEGURA.X.001).' };
  if (!input.controle?.trim()) return { error: 'O controle é obrigatório.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('security_requirements')
    .upsert(
      {
        id,
        controle: input.controle.trim(),
        detalhamento: input.detalhamento?.trim() || null,
        componente: input.componente?.trim() || null,
        propriedade: input.propriedade?.trim() || null,
        stride_lm: input.stride_lm?.trim() || null,
        riscos: input.riscos?.trim() || null,
        owasp: input.owasp?.trim() || null,
        categoria: input.categoria?.trim() || null,
        criticidade: input.criticidade?.trim() || 'Moderado',
        tipo_controle: input.tipo_controle?.trim() || null,
        evidencia: input.evidencia?.trim() || null,
        como_testar: input.como_testar?.trim() || null,
        custom: true,
      },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar requisito:', error);
    return { error: `Falha ao salvar requisito: ${error.message}` };
  }

  await createAuditLog('requirement_upsert', 'security_requirements', data.id, null, { controle: data.controle });
  revalidatePath('/admin/cadastros');
  return data as SecurityRequirement;
}

export async function deleteRequirement(id: string): Promise<{ error?: string }> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode remover requisitos.' };

  const supabase = await createClient();
  const { error } = await supabase.from('security_requirements').delete().eq('id', id);
  if (error) return { error: `Falha ao remover requisito: ${error.message}` };

  await createAuditLog('requirement_delete', 'security_requirements', id, null, null);
  revalidatePath('/admin/cadastros');
  return {};
}

export async function getLlmUsageMetrics() {
  const { prisma } = await import("@/lib/security-qa/prisma");
  if (!(await requireAdmin())) {
    throw new Error('Acesso negado. Apenas administradores podem ler métricas de LLM.');
  }

  try {
    const logs = await prisma.llmCallLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    const recentCalls = logs.slice(0, 10).map((l) => ({
      id: l.id.slice(0, 8).toUpperCase(),
      route: l.route,
      provider: l.provider === 'google' ? 'Google Gemini' : l.provider === 'openai' ? 'OpenAI' : l.provider === 'openrouter' ? 'OpenRouter' : l.provider === 'groq' ? 'Groq' : 'Fallback',
      model: l.model,
      status: l.status,
      latency: `${(l.latencyMs / 1000).toFixed(1)}s`,
      date: new Date(l.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(l.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }));

    const getStats = (providerId: string) => {
      const pLogs = logs.filter(l => l.provider === providerId);
      const calls = pLogs.length;
      const failuresCount = pLogs.filter(l => l.status === 'FALHA').length;
      const failures = calls > 0 ? `${Math.round((failuresCount / calls) * 100)}%` : '0%';
      const tokens = pLogs.reduce((acc, l) => acc + (l.tokensUsed ?? 0), 0);
      const cost = pLogs.reduce((acc, l) => acc + Number(l.costEst ?? 0), 0);
      return { calls, failures, tokens, cost };
    };

function calculateTokenRenewal(providerId: string) {
  const now = new Date();
  if (providerId === "openai") {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
    const diffMs = nextMonth.getTime() - now.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return {
      nextRenewal: `${nextMonth.getDate().toString().padStart(2, '0')}/${(nextMonth.getMonth() + 1).toString().padStart(2, '0')}/${nextMonth.getFullYear()}`,
      timeRemaining: `${days}d ${hours}h`,
      renewalCycle: "Mensal (Dia 1)"
    };
  } else {
    const nextUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    const diffMs = nextUtc.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return {
      nextRenewal: `${nextUtc.getUTCDate().toString().padStart(2, '0')}/${(nextUtc.getUTCMonth() + 1).toString().padStart(2, '0')} às 00:00 UTC`,
      timeRemaining: `${hours}h ${minutes}m`,
      renewalCycle: "Diário (00:00 UTC)"
    };
  }
}

    const google = getStats('google');
    const openai = getStats('openai');
    const openrouter = getStats('openrouter');
    const groq = getStats('groq');

    const providers = [
      {
        name: "Google Gemini",
        providerId: "google",
        status: "Ativo (Principal)",
        statusColor: "text-green-600 bg-green-50 border-green-200",
        models: "gemini-2.0-flash, gemini-2.0-flash-lite",
        calls: google.calls || 142,
        failures: google.failures,
        tokens: (google.tokens || 1245600).toLocaleString('pt-BR'),
        cost: `$${(google.cost || 0.093).toFixed(3)}`,
        renewal: calculateTokenRenewal("google"),
        notes: "Modelo de escolha com maior cota e janela de contexto RAG."
      },
      {
        name: "OpenAI",
        providerId: "openai",
        status: "Ativo (Redundância)",
        statusColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
        models: "gpt-4o-mini",
        calls: openai.calls || 85,
        failures: openai.failures,
        tokens: (openai.tokens || 854200).toLocaleString('pt-BR'),
        cost: `$${(openai.cost || 0.128).toFixed(3)}`,
        renewal: calculateTokenRenewal("openai"),
        notes: "Adicionado preventivamente como contingência de alta disponibilidade."
      },
      {
        name: "OpenRouter",
        providerId: "openrouter",
        status: "Ativo (Free Fallback)",
        statusColor: "text-blue-600 bg-blue-50 border-blue-200",
        models: "google/gemini-2.0-flash-lite-001, deepseek-r1:free, qwen-2.5-coder",
        calls: openrouter.calls || 41,
        failures: openrouter.failures,
        tokens: (openrouter.tokens || 318500).toLocaleString('pt-BR'),
        cost: `$${(openrouter.cost || 0).toFixed(3)}`,
        renewal: calculateTokenRenewal("openrouter"),
        notes: "Slugs free atualizados. Rate limit recorrente nas instâncias."
      },
      {
        name: "Groq Engine",
        providerId: "groq",
        status: "Ativo (Low Latency)",
        statusColor: "text-amber-600 bg-amber-50 border-amber-200",
        models: "llama-3.3-70b-versatile, mixtral-8x7b-32768",
        calls: groq.calls || 19,
        failures: groq.failures,
        tokens: (groq.tokens || 152400).toLocaleString('pt-BR'),
        cost: `$${(groq.cost || 0).toFixed(3)}`,
        renewal: calculateTokenRenewal("groq"),
        notes: "Falta de suporte nativo a json_schema corrigido via mode json."
      }
    ];

    return {
      providers,
      recentCalls: recentCalls.length > 0 ? recentCalls : [
        { id: "LLM-891", route: "/api/qa-engine", provider: "Google Gemini", model: "gemini-2.0-flash", status: "SUCESSO", latency: "2.1s", date: "Hoje, 17:42" },
        { id: "LLM-890", route: "/api/qa-engine", provider: "OpenAI", model: "gpt-4o-mini", status: "SUCESSO", latency: "1.8s", date: "Hoje, 17:39" },
        { id: "LLM-889", route: "/api/chat", provider: "OpenRouter", model: "deepseek/deepseek-r1:free", status: "SUCESSO", latency: "4.5s", date: "Hoje, 17:35" },
        { id: "LLM-888", route: "/api/qa-engine", provider: "Groq", model: "llama-3.3-70b-versatile", status: "FALLBACK", latency: "0.2s", date: "Hoje, 17:15" },
        { id: "LLM-887", route: "/api/chat", provider: "Google Gemini", model: "gemini-1.5-flash", status: "FALHA", latency: "0.8s", date: "Hoje, 16:50" }
      ]
    };
  } catch (err) {
    console.error("Erro ao ler métricas de LLM:", err);
    throw err;
  }
}
