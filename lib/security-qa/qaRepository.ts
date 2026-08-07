/**
 * Centro de Security QA — Repositório de persistência (server-only).
 *
 * NÃO usa o cliente padrão do Supabase para banco. Migrado para Prisma ORM
 * (fonte da verdade em prisma/schema.prisma). O Supabase segue em uso APENAS
 * para Storage (ver lib/security-qa/storage.ts). Nunca importar em components.
 */
import { prisma } from './prisma';
import { Prisma } from '@/lib/generated/prisma/client';
import type { QaAnalysis, QaResult } from './types';

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

type QaResultRow = Prisma.QaResultGetPayload<{ include: { project: true } }>;

/** Converte o model do Prisma (camelCase + relations) de volta para o domínio
 *  QaResult (snake_case), preservando a API usada pelos components. */
function toQaResult(row: QaResultRow): QaResult {
  const ratio =
    typeof row.compressionRatio === 'number'
      ? Math.round(row.compressionRatio * 10000) / 10000
      : row.compressionRatio !== null
        ? Number(row.compressionRatio)
        : null;

  return {
    id: row.id,
    project_name: row.project.name,
    environment_url: row.project.environmentUrl,
    requirements: row.project.requirements,
    original_file_name: row.originalFileName,
    temp_storage_path: row.tempStoragePath,
    archived_file_path: row.archivedFilePath,
    archived_file_url: row.archivedFileUrl,
    archived_size_bytes: Number(row.archivedSizeBytes),
    original_size_bytes: Number(row.originalSizeBytes),
    compression_ratio: ratio,
    compliance_percent: Number(row.compliancePercent),
    overall_rating: row.overallRating as QaResult['overall_rating'],
    executive_summary: row.executiveSummary,
    findings: row.findings as unknown as QaResult['findings'],
    status: row.status as QaResult['status'],
    error_message: row.errorMessage,
    created_by: row.project.createdBy,
    created_at: row.createdAt.toISOString(),
  };
}

export async function insertQaResult(input: PersistQaResultInput): Promise<QaResult> {
  const compressionRatio =
    input.originalSizeBytes > 0
      ? input.archivedSizeBytes / input.originalSizeBytes
      : null;

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
      archivedFilePath: input.archivedFilePath,
      archivedFileUrl: input.archivedFileUrl,
      archivedSizeBytes: input.archivedSizeBytes,
      originalSizeBytes: input.originalSizeBytes,
      compressionRatio,
      compliancePercent: input.analysis.compliancePercent,
      overallRating: input.analysis.overallRating,
      executiveSummary: input.analysis.executiveSummary,
      findings: input.analysis.findings as unknown as Prisma.InputJsonValue,
      status: 'concluido',
    },
    include: { project: true },
  });

  return toQaResult(created);
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