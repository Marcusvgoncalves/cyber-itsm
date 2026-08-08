"use server";

import { getAuthService } from "@/lib/auth/authService";
import { revalidatePath } from "next/cache";
import { deleteQaResult } from "@/lib/security-qa/qaRepository";
import { createAuditLog } from "@/lib/audit/audit";

/**
 * Server Actions do Centro de Security QA.
 *
 * Exclusão de análises é exclusiva do perfil ADMIN (Matriz SoD). O ato de
 * excluir remove os artefatos forenses do Storage e o registro, sempre
 * registrando a ação na trilha de auditoria.
 */
export async function deleteQaAnalysis(resultId: string): Promise<{ ok?: boolean; error?: string }> {
  const context = await getAuthService().getUser();
  if (!context) return { error: 'Não autenticado.' };
  if (context.user.role !== 'admin') {
    return { error: 'Acesso negado. Apenas usuários ADMIN podem excluir análises de Security QA (Matriz SoD).' };
  }

  try {
    const removed = await deleteQaResult(resultId);
    await createAuditLog('qa_analysis_delete', 'qa_results', resultId, null, {
      project_name: removed.project_name,
      original_file_name: removed.original_file_name,
    });
    revalidatePath('/security-qa');
    return { ok: true };
  } catch (err) {
    console.error('[Security QA] Falha ao excluir análise:', err);
    return { error: err instanceof Error ? err.message : 'Falha ao excluir a análise de Security QA.' };
  }
}
