/**
 * Centro de Security QA — Repositório de persistência (server-only).
 *
 * Acesso exclusivo à tabela public.qa_results via service role. Nunca
 * importar este módulo a partir de componentes client (mantém o Bounded
 * Context isolado do módulo ITSM legado).
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { QA_TABLE } from './config';
import type { QaAnalysis, QaResult } from './types';

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    }
  );
}

export interface PersistQaResultInput {
  projectName: string;
  environmentUrl: string;
  requirements: string;
  originalFileName: string;
  tempStoragePath: string;
  archivedFilePath: string;
  archivedFileUrl: string | null;
  archivedSizeBytes: number;
  originalSizeBytes: number;
  analysis: QaAnalysis;
  createdBy: string | null;
}

export async function insertQaResult(input: PersistQaResultInput): Promise<QaResult> {
  const client = createServiceClient();
  const compressionRatio =
    input.originalSizeBytes > 0
      ? Math.round((input.archivedSizeBytes / input.originalSizeBytes) * 10000) / 10000
      : null;

  const { data, error } = await client
    .from(QA_TABLE)
    .insert({
      project_name: input.projectName,
      environment_url: input.environmentUrl,
      requirements: input.requirements,
      original_file_name: input.originalFileName,
      temp_storage_path: input.tempStoragePath,
      archived_file_path: input.archivedFilePath,
      archived_file_url: input.archivedFileUrl,
      archived_size_bytes: input.archivedSizeBytes,
      original_size_bytes: input.originalSizeBytes,
      compression_ratio: compressionRatio,
      compliance_percent: input.analysis.compliancePercent,
      overall_rating: input.analysis.overallRating,
      executive_summary: input.analysis.executiveSummary,
      findings: input.analysis.findings,
      status: 'concluido',
      created_by: input.createdBy,
    })
    .select()
    .single();

  if (error) throw new Error(`Falha ao persistir resultado em ${QA_TABLE}: ${error.message}`);
  return data as QaResult;
}

export async function getQaResultById(id: string): Promise<QaResult | null> {
  const client = createServiceClient();
  const { data, error } = await client.from(QA_TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as QaResult) ?? null;
}

export async function listQaResults(limit = 50): Promise<QaResult[]> {
  const client = createServiceClient();
  const { data, error } = await client
    .from(QA_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as QaResult[]) ?? [];
}
