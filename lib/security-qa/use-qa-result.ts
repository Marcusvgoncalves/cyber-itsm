"use client";

/**
 * Hook Realtime — acompanha o ciclo de vida de um laudo de Security QA.
 *
 * Após o publisher retornar o `id` (status PROCESSANDO), o componente assina
 * um canal do Supabase Realtime filtrando UPDATEs em public.qa_results por id.
 * Quando o worker promove o registro para CONCLUIDO, o estado local é
 * atualizado instantaneamente (Score + PDF) sem polling.
 */
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { QaFinding, QaOverallRating, QaStatus } from "@/lib/security-qa/types";

export type QaRealtimePhase = "idle" | "processing" | "done" | "error";

/** Snapshot leve e imediato com o que a UI precisa exibir ao concluir. */
export interface QaCompletionSnapshot {
  id: string;
  status: QaStatus;
  compliancePercent: number | null;
  overallRating: QaOverallRating | null;
  executiveSummary: string | null;
  findings: QaFinding[];
  pdfFileUrl: string | null;
  createdAt: string | null;
}

export interface UseQaResultReturn {
  phase: QaRealtimePhase;
  completion: QaCompletionSnapshot | null;
  error: string | null;
  reset: () => void;
}

/** Linha crua enviada pelo Realtime (postgres_changes => payload.new). */
type RealtimeRow = Record<string, unknown> & { id?: string; status?: string };

function parseFindings(value: unknown): QaFinding[] {
  if (Array.isArray(value)) return value as QaFinding[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as QaFinding[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapRealtimeRow(row: RealtimeRow): QaCompletionSnapshot {
  return {
    id: String(row.id ?? ""),
    status: (row.status as QaStatus) ?? "PROCESSANDO",
    compliancePercent:
      typeof row.compliance_percent === "number" ? row.compliance_percent : null,
    overallRating: (row.overall_rating as QaOverallRating) ?? null,
    executiveSummary:
      typeof row.executive_summary === "string" ? row.executive_summary : null,
    findings: parseFindings(row.findings),
    pdfFileUrl: typeof row.pdf_file_url === "string" ? row.pdf_file_url : null,
    createdAt:
      typeof row.created_at === "string" ? row.created_at : null,
  };
}

export function useQaResult(resultId: string | null): UseQaResultReturn {
  const [phase, setPhase] = useState<QaRealtimePhase>("idle");
  const [completion, setCompletion] = useState<QaCompletionSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase("idle");
    setCompletion(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!resultId) {
      setPhase("idle");
      setCompletion(null);
      setError(null);
      return;
    }

    setPhase("processing");
    setError(null);

    const supabase = createClient();

    let isCancelled = false;
    const checkStatus = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from("qa_results")
          .select("*")
          .eq("id", resultId)
          .maybeSingle();

        if (isCancelled || fetchErr || !data) return;

        const snapshot = mapRealtimeRow(data as RealtimeRow);

        if (snapshot.status === "CONCLUIDO") {
          setCompletion(snapshot);
          setPhase("done");
        } else if (snapshot.status === "FALHA") {
          setError(
            typeof data.error_message === "string" && data.error_message.trim().length > 0
              ? data.error_message
              : "O processamento em background falhou."
          );
          setPhase("error");
        }
      } catch {}
    };

    // Verificação inicial rápida + polling leve a cada 2.5s
    checkStatus();
    const intervalId = setInterval(checkStatus, 2500);

    const channel = supabase
      .channel(`qa-result:${resultId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "qa_results",
          filter: `id=eq.${resultId}`,
        },
        (payload) => {
          const row = payload.new as RealtimeRow;
          const snapshot = mapRealtimeRow(row);

          if (snapshot.status === "CONCLUIDO") {
            setCompletion(snapshot);
            setPhase("done");
          } else if (snapshot.status === "FALHA") {
            setError(
              typeof row.error_message === "string" && row.error_message.trim().length > 0
                ? row.error_message
                : "O processamento em background falhou."
            );
            setPhase("error");
          }
        }
      )
      .subscribe();

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [resultId]);

  return { phase, completion, error, reset };
}
