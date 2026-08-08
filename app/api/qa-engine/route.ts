import { z } from 'zod';
import { after } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import { getAuthService } from '@/lib/auth/authService';
import { createPendingQaResult } from '@/lib/security-qa/qaRepository';
import { sanitizeText } from '@/lib/security-qa/analysis-engine';
import { runLocalQaProcess } from '@/lib/security-qa/local-worker';
import { logSystemAudit } from '@/lib/audit/audit';

// ============================================================================
// Centro de Security QA — Publisher (Monolito Orientado a Eventos com Resilience).
//
// Esta rota registra o laudo em status PROCESSANDO e retorna 200 de imediato.
// Se o Inngest estiver configurado (INNGEST_EVENT_KEY), publica o evento.
// Caso contrário (ou em falha de conexão), utiliza o `after()` do Next.js 16 para
// executar o `runLocalQaProcess` no ciclo de vida Serverless sem travar a UI.
// ============================================================================

export const runtime = 'nodejs';
export const maxDuration = 30;

/** Contrato estrito de entrada (tipagem com Zod). */
const QaEngineRequestSchema = z.object({
  projectName: z.string().trim().min(1),
  environmentUrl: z.string().trim().min(1),
  requirements: z.string().trim().min(1),
  fileName: z.string().trim().min(1),
  /** Caminho do objeto dentro do bucket qa-temp-evidences. */
  storagePath: z.string().trim().min(1),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = QaEngineRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error:
          'Campos obrigatórios ausentes ou inválidos: projectName, environmentUrl, requirements, fileName e storagePath.',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { projectName, environmentUrl, requirements, fileName, storagePath } = parsed.data;

  // 1) Registro pendente (status PROCESSANDO) — retorno imediato
  const pending = await createPendingQaResult({
    projectName: sanitizeText(projectName),
    environmentUrl: sanitizeText(environmentUrl),
    requirements: sanitizeText(requirements),
    originalFileName: sanitizeText(fileName),
    tempStoragePath: sanitizeText(storagePath),
    createdBy: null,
  });

  // Auditoria: quem solicitou a avaliação (session id quando autenticado).
  const context = await getAuthService().getUser().catch(() => null);
  await logSystemAudit(context?.session.id ?? null, 'qa_analysis_request', 'qa_results', pending.id, null, {
    project_name: sanitizeText(projectName),
    original_file_name: sanitizeText(fileName),
  });

  const hasInngestKey = !!process.env.INNGEST_EVENT_KEY;

  if (hasInngestKey) {
    try {
      await inngest.send({
        name: 'qa/process.report',
        data: {
          qaResultId: pending.id,
          fileUrl: pending.temp_storage_path ?? storagePath,
        },
      });
      console.log(`[Security QA Publisher] Laudo ${pending.id} enfileirado no Inngest (PROCESSANDO).`);
    } catch (err) {
      console.warn(
        `[Security QA Publisher] Falha ao enviar para Inngest, executando worker local via after()...`,
        err
      );
      after(async () => {
        await runLocalQaProcess(pending.id, pending.temp_storage_path ?? storagePath);
      });
    }
  } else {
    console.log(
      `[Security QA Publisher] INNGEST_EVENT_KEY ausente. Executando worker local via after()...`
    );
    after(async () => {
      await runLocalQaProcess(pending.id, pending.temp_storage_path ?? storagePath);
    });
  }

  // 2) Sucesso imediato: o frontend assina a atualização via Realtime ou Polling
  return Response.json({ id: pending.id, status: 'PROCESSANDO' });
}
