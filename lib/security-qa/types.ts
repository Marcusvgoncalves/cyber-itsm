/**
 * Centro de Security QA — Tipos de domínio (Bounded Context isolado).
 */

export type QaFindingStatus = 'conforme' | 'parcial' | 'nao_conforme';

export type QaOverallRating = 'baixo' | 'medio' | 'alto' | 'critico';

/** Hallucination guardrail: a IA só aponta requisitos que estejam no escopo. */
export interface QaFinding {
  /** ID/identificador do requisito citado pelo dono do escopo (ex.: VIVO.SEGURA.*). */
  requirementId: string;
  requirementName: string;
  status: QaFindingStatus;
  /** Evidência extraída do relatório de segurança que sustenta o veredito. */
  evidence: string;
  recommendation: string;
}

/** Estrutura JSON devolvida pelo motor (streamObject). */
export interface QaAnalysis {
  compliancePercent: number;
  overallRating: QaOverallRating;
  executiveSummary: string;
  findings: QaFinding[];
}

/** Linha persistida em public.qa_results. */
export interface QaResult {
  id: string;
  project_name: string;
  environment_url: string;
  requirements: string;
  original_file_name: string;
  temp_storage_path: string | null;
  archived_file_path: string;
  archived_file_url: string | null;
  archived_size_bytes: number;
  original_size_bytes: number;
  compression_ratio: number | null;
  compliance_percent: number;
  overall_rating: QaOverallRating;
  executive_summary: string;
  findings: QaFinding[];
  status: 'concluido' | 'falha';
  error_message: string | null;
  created_by: string | null;
  created_at: string;
}

/** Eventos NDJSON emitidos pela API /api/qa-engine durante o pipeline. */
export type QaStreamEvent =
  | { type: 'status'; phase: 'download' | 'analysis' | 'archive' | 'purge'; message: string }
  | { type: 'delta'; partial: Partial<QaAnalysis> }
  | { type: 'done'; result: QaResult }
  | { type: 'error'; message: string };

/** Payload da requisição ao motor de IA. */
export interface QaEngineRequest {
  projectName: string;
  environmentUrl: string;
  requirements: string;
  fileName: string;
  /** Caminho do arquivo dentro do bucket qa-temp-evidences. */
  storagePath: string;
}
