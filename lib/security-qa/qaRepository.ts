/**
 * Centro de Security QA — Repositório de persistência (server-only).
 *
 * NÃO usa o cliente padrão do Supabase para banco. Migrado para Prisma ORM
 * (fonte da verdade em prisma/schema.prisma). O Supabase segue em uso APENAS
 * para Storage (ver lib/security-qa/storage.ts). Nunca importar em components.
 *
 * Ciclo de vida orientado a eventos (Inngest):
 *   - createPendingQaResult: publisher registra o laudo com status PROCESSANDO;
 *   - completeQaResult:      worker preenche conformidade/arquivamento/PDF e
 *                            promove para CONCLUIDO;
 *   - failQaResult:          marca FALHA após retries exauridos.
 */
import { prisma } from './prisma';
import { Prisma } from '@/lib/generated/prisma/client';
import type { QaAnalysis, QaResult } from './types';

export interface CreatePendingQaResultInput {
  projectName: string;
  environmentUrl: string;
  requirements: string;
  originalFileName: string;
  tempStoragePath: string;
  createdBy: string | null;
}

export interface CompleteQaResultInput {
  archivedFilePath: string;
  archivedFileUrl: string | null;
  archivedSizeBytes: number;
  originalSizeBytes: number;
  analysis: QaAnalysis;
  pdfFilePath: string | null;
  pdfFileUrl: string | null;
}

type QaResultRow = Prisma.QaResultGetPayload<{ include: { project: true } }>;

/** Converte o model do Prisma (camelCase + relations) de volta para o domínio
 *  QaResult (snake_case), preservando a API usada pelos components. Campos
 *  ainda não preenchidos (status PROCESSANDO) recebem valores neutros. */
function toQaResult(row: QaResultRow): QaResult {
  const ratio =
    row.compressionRatio !== null
      ? Math.round(Number(row.compressionRatio) * 10000) / 10000
      : null;

  return {
    id: row.id,
    project_name: row.project.name,
    environment_url: row.project.environmentUrl,
    requirements: row.project.requirements,
    original_file_name: row.originalFileName,
    temp_storage_path: row.tempStoragePath,
    archived_file_path: row.archivedFilePath ?? '',
    archived_file_url: row.archivedFileUrl,
    archived_size_bytes: Number(row.archivedSizeBytes ?? 0),
    original_size_bytes: Number(row.originalSizeBytes ?? 0),
    compression_ratio: ratio,
    compliance_percent: Number(row.compliancePercent ?? 0),
    overall_rating: (row.overallRating ?? 'medio') as QaResult['overall_rating'],
    executive_summary: row.executiveSummary ?? '',
    findings: row.findings as unknown as QaResult['findings'],
    status: row.status as QaResult['status'],
    error_message: row.errorMessage,
    pdf_file_path: row.pdfFilePath,
    pdf_file_url: row.pdfFileUrl,
    created_by: row.project.createdBy,
    created_at: row.createdAt.toISOString(),
  };
}

/** Publisher: cria o laudo apenas com os metadados da evidência (status PROCESSANDO). */
export async function createPendingQaResult(
  input: CreatePendingQaResultInput
): Promise<QaResult> {
  const project = await prisma.qaProject.upsert({
    where: { name: input.projectName },
    update: {
      environmentUrl: input.environmentUrl,
      requirements: input.requirements,
      createdBy: input.createdBy,
    },
    create: {
      name: input.projectName,
      environmentUrl: input.environmentUrl,
      requirements: input.requirements,
      createdBy: input.createdBy,
    },
  });

  const created = await prisma.qaResult.create({
    data: {
      projectId: project.id,
      originalFileName: input.originalFileName,
      tempStoragePath: input.tempStoragePath,
      status: 'PROCESSANDO',
    },
    include: { project: true },
  });

  return toQaResult(created);
}

/** Worker: conclui o laudo preenchendo conformidade, arquivamento e PDF. */
export async function completeQaResult(
  id: string,
  input: CompleteQaResultInput
): Promise<QaResult> {
  const compressionRatio =
    input.originalSizeBytes > 0
      ? input.archivedSizeBytes / input.originalSizeBytes
      : null;

  const updated = await prisma.qaResult.update({
    where: { id },
    data: {
      archivedFilePath: input.archivedFilePath,
      archivedFileUrl: input.archivedFileUrl,
      archivedSizeBytes: input.archivedSizeBytes,
      originalSizeBytes: input.originalSizeBytes,
      compressionRatio,
      compliancePercent: input.analysis.compliancePercent,
      overallRating: input.analysis.overallRating,
      executiveSummary: input.analysis.executiveSummary,
      findings: input.analysis.findings as unknown as Prisma.InputJsonValue,
      pdfFilePath: input.pdfFilePath,
      pdfFileUrl: input.pdfFileUrl,
      status: 'CONCLUIDO',
      errorMessage: null,
    },
    include: { project: true },
  });

  return toQaResult(updated);
}

/** Worker/fallback: marca o laudo como FALHA com a mensagem de erro. */
export async function failQaResult(id: string, errorMessage: string): Promise<QaResult> {
  const updated = await prisma.qaResult.update({
    where: { id },
    data: {
      status: 'FALHA',
      errorMessage,
    },
    include: { project: true },
  });

  return toQaResult(updated);
}

export async function getQaResultById(id: string): Promise<QaResult | null> {
  const row = await prisma.qaResult.findUnique({
    where: { id },
    include: { project: true },
  });
  if (!row) return null;
  return toQaResult(row);
}

export async function listQaResults(limit = 50): Promise<QaResult[]> {
  const rows = await prisma.qaResult.findMany({
    include: { project: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(toQaResult);
}
