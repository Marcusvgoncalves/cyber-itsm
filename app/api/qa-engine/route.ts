import { z } from 'zod';
import { inngest } from '@/lib/inngest/client';
import { createPendingQaResult, failQaResult } from '@/lib/security-qa/qaRepository';
import { sanitizeText } from '@/lib/security-qa/analysis-engine';

// ============================================================================
// Centro de Security QA — Publisher (Monolito Orientado a Eventos).
//
// Esta rota NÃO executa mais IA/PDF de forma síncrona. Fluxo:
//   1. Recebe os metadados + caminho da evidência (já no bucket temporário);
//   2. Cria o registro em public.qa_results com status 'PROCESSANDO';
//   3. Publica o evento `qa/process.report` no Inngest (worker de background);
//   4. Retorna 200 imediato com o id do registro.
// A UI acompanha a conclusão via Supabase Realtime (postgres_changes).
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

  // 2) Registro pendente (status PROCESSANDO) — retorno imediato, sem IA.
  const pending = await createPendingQaResult({
    projectName: sanitizeText(projectName),
    environmentUrl: sanitizeText(environmentUrl),
    requirements: sanitizeText(requirements),
    originalFileName: sanitizeText(fileName),
    tempStoragePath: sanitizeText(storagePath),
    createdBy: null,
  });

  // 3) Publica o evento para o worker de background (Inngest).
  try {
    await inngest.send({
      name: 'qa/process.report',
      data: {
        qaResultId: pending.id,
        fileUrl: pending.temp_storage_path ?? storagePath,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Security QA Publisher] Falha ao disparar evento Inngest:', err);
    // Evita laudo "órfão" em PROCESSANDO: marca FALHA e avisa o frontend.
    await failQaResult(pending.id, `Falha ao enfileirar o processamento: ${message}`).catch(
      () => undefined
    );
    return Response.json(
      {
        error:
          'Falha ao enfileirar o processamento em background. Verifique a configuração do Inngest (`npx inngest dev`).',
      },
      { status: 500 }
    );
  }

  console.log(`[Security QA Publisher] Laudo ${pending.id} enfileirado (PROCESSANDO).`);

  // 4) Sucesso imediato: o frontend assina o Realtime pelo id.
  return Response.json({ id: pending.id, status: 'PROCESSANDO' });
}
