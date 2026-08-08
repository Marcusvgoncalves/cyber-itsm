/**
 * Inngest serve() — ponto de contato entre o orquestrador e os workers.
 *
 * O Inngest Dev Server (local) e o Cloud chamam esta rota para:
 *   - Registrar as functions (dev/cloud sync);
 *   - Entregar as execuções disparadas pelo evento `qa/process.report`.
 *
 * Precisa de runtime Node.js (usamos @react-pdf/renderer, zlib e Prisma).
 */
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { processQaReport } from "@/lib/inngest/functions/processQaReport";
import { auditRetentionJob } from "@/lib/inngest/functions/auditRetention";

export const runtime = "nodejs";
// Funções de background podem exceder o timeout padrão (60s). 300s cobre
// parsing, multiagente LLM e geração do PDF dentro de um único request.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processQaReport, auditRetentionJob],
});
