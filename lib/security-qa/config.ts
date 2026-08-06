/**
 * Centro de Security QA — Configuração isolada do Bounded Context.
 *
 * Nenhuma dependência do módulo ITSM legado. Os valores de bucket/tamanho
 * podem ser sobrescritos por variáveis de ambiente sem tocar em código.
 */

export const QA_BUCKETS = {
  /** Bucket temporário de evidências brutas (upload direto do frontend). */
  temp: process.env.QA_TEMP_BUCKET ?? 'qa-temp-evidences',
  /** Bucket imutável de arquivamento forense (apenas service role, server-side). */
  archive: process.env.QA_ARCHIVE_BUCKET ?? 'qa-logs-archive',
} as const;

/** Extensões aceitas na ingestão de evidências. */
export const QA_ALLOWED_EXTENSIONS = ['.json', '.xml', '.txt'] as const;

/** Tamanho máximo do arquivo de evidência (5 MB, alinhado ao storage gratuito). */
export const QA_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/** Tabela do banco (isolada por schema implícito public.qa_results). */
export const QA_TABLE = 'qa_results';

/** Nível de compressão GZIP para evidências forenses (máximo = preservação). */
export const QA_GZIP_LEVEL = 9;

/** Validade do URL assinado para download da evidência arquivada (segundos). */
export const QA_SIGNED_URL_EXPIRES = 60 * 60 * 24 * 7;

/** Modelo do motor de IA (alias rolante, alinhado ao agente legado). */
export const QA_MODEL_ID = 'gemini-flash-latest';

/** Limite de execução da função na plataforma (Vercel Pro: 60s em Hobby). */
export const QA_MAX_DURATION = 60;
