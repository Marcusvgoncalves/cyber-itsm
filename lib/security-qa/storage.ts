/**
 * Centro de Security QA — Camada de Storage e Compressão (server-only).
 *
 * Responsável pela transição de buckets no Supabase:
 *   qa-temp-evidences (evidência bruta)  →  qa-logs-archive (GZIP forense).
 * Usa exclusivamente o client com service role; nunca importar em componentes.
 */
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { gzipSync } from 'node:zlib';
import { QA_BUCKETS, QA_GZIP_LEVEL, QA_SIGNED_URL_EXPIRES } from './config';
import { parseFileContent } from './file-parser';

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    }
  );
}

/** Garante a existência dos buckets de forma idempotente (service role). */
export async function ensureQaBuckets(): Promise<void> {
  const client = createServiceClient();
  await Promise.all([
    ensureBucket(client, QA_BUCKETS.temp, {
      public: false,
      allowedMimeTypes: [
        'application/json',
        'application/xml',
        'text/plain',
        'application/x-www-form-urlencoded',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/jpg',
        'image/png',
      ],
      fileSizeLimit: 15 * 1024 * 1024,
    }),
    ensureBucket(client, QA_BUCKETS.archive, {
      public: false,
      allowedMimeTypes: ['application/gzip', 'application/x-gzip'],
      fileSizeLimit: 50 * 1024 * 1024,
    }),
  ]);
}

async function ensureBucket(
  client: ReturnType<typeof createServiceClient>,
  id: string,
  options: { public: boolean; allowedMimeTypes: string[]; fileSizeLimit: number }
): Promise<void> {
  const { data: existing } = await client.storage.getBucket(id);
  if (existing) return;
  const { error } = await client.storage.createBucket(id, options);
  if (error && !error.message.toLowerCase().includes('already exists')) {
    throw error;
  }
}

/** Baixa a evidência bruta do bucket temporário e extrai o conteúdo textual/visual unificado. */
export async function downloadEvidenceText(storagePath: string): Promise<{ text: string; bytes: number }> {
  const client = createServiceClient();
  const { data, error } = await client.storage.from(QA_BUCKETS.temp).download(storagePath);
  if (error) throw new Error(`Falha ao baixar evidência de '${QA_BUCKETS.temp}/${storagePath}': ${error.message}`);
  
  const buffer = Buffer.from(await data.arrayBuffer());
  const { text, originalSizeBytes } = await parseFileContent(buffer, storagePath);

  if (!text.trim()) throw new Error('Evidência baixada está vazia ou sem texto extraível.');
  return { text, bytes: originalSizeBytes };
}

/**
 * Comprime o conteúdo original em GZIP (zlib nativo) e envia ao bucket de
 * arquivamento. Retorna o caminho do objeto e o tamanho comprimido.
 */
export async function archiveGzippedEvidence(
  textContent: string,
  targetPath: string
): Promise<{ archivedPath: string; gzSizeBytes: number; originalSizeBytes: number }> {
  const originalSizeBytes = Buffer.byteLength(textContent, 'utf8');
  const gzBuffer = gzipSync(Buffer.from(textContent, 'utf8'), { level: QA_GZIP_LEVEL });

  const client = createServiceClient();
  const { error } = await client.storage.from(QA_BUCKETS.archive).upload(targetPath, gzBuffer, {
    contentType: 'application/gzip',
    cacheControl: '3600',
    upsert: false,
  });
  if (error) {
    throw new Error(`Falha no upload do GZIP para '${QA_BUCKETS.archive}/${targetPath}': ${error.message}`);
  }

  return { archivedPath: targetPath, gzSizeBytes: gzBuffer.byteLength, originalSizeBytes };
}

/** Exclui (expurga) o dado bruto do bucket temporário. */
export async function purgeTemporaryEvidence(storagePath: string): Promise<void> {
  const client = createServiceClient();
  const { error } = await client.storage.from(QA_BUCKETS.temp).remove([storagePath]);
  if (error) {
    throw new Error(`Falha ao expurgar evidência bruta '${storagePath}': ${error.message}`);
  }
}

/** Gera URL assinado (temporário) para download da evidência arquivada. */
export async function getArchivedSignedUrl(archivedPath: string): Promise<string | null> {
  const client = createServiceClient();
  const { data, error } = await client.storage
    .from(QA_BUCKETS.archive)
    .createSignedUrl(archivedPath, QA_SIGNED_URL_EXPIRES);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
