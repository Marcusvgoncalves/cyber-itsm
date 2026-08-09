/**
 * ============================================================================
 * SEED PRODUÇÃO RAG — Base de Conhecimento Vetorial (Base-SD-v4.1)
 * ============================================================================
 * Carga massiva dos requisitos de arquitetura segura na tabela pgvector
 * `public.knowledge_articles` do Supabase, com embeddings `gemini-embedding-2`
 * (3072 dimensões).
 *
 * Execução ESTRITAMENTE via terminal (Node.js/TSX) — script 100% isolado,
 * impacto ZERO na aplicação em produção.
 *
 *   # Instala o tsx sob demanda (sem tocar em devDependencies do projeto):
 *   npx --yes tsx scripts/seed-production-rag.ts
 *
 *   # Modo validação (não grava nada no banco):
 *   npx --yes tsx scripts/seed-production-rag.ts --dry-run
 *
 * Garantias de segurança desta operação:
 *  - Idempotência: SELECT prévio dos `title` existentes na tabela; registros já
 *    presentes são PULADOS (o script pode rodar N vezes sem duplicar).
 *  - Rate Limit (429): processamento em LOTES de 10 + delay de 2s entre lotes,
 *    retry com backoff exponencial e fallback item-a-item.
 *  - Inserção via Prisma `$executeRaw` (pgvector) — mesmo padrão validado no
 *    teste de infraestrutura (parâmetros + cast `::vector`).
 * ============================================================================
 */

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import fs from 'node:fs';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma/client';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed, embedMany, type EmbeddingModel } from 'ai';

// ----------------------------------------------------------------------------
// Configuração do script
// ----------------------------------------------------------------------------
const EMBEDDING_MODEL = 'gemini-embedding-2';
const EMBEDDING_DIMENSIONS = 3072;
const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES_MS = 2000;
const MAX_ATTEMPTS = 4;
const SOURCE_LABEL = 'Base-SD-v4.1';

// Localiza `data/requisitos-sd.json` relativo ao script (funciona em CJS e ESM).
const scriptDir =
  typeof __dirname !== 'undefined'
    ? __dirname
    : fileURLToPath(new URL('.', import.meta.url));
const DATA_FILE = resolve(scriptDir, '..', 'data', 'requisitos-sd.json');

// ----------------------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------------------
interface Requisito {
  code: string;
  description: string;
}

interface Counters {
  total: number;
  skippedExisting: number;
  inserted: number;
  dimsMismatch: number;
  failed: number;
}

// ----------------------------------------------------------------------------
// Utilitários
// ----------------------------------------------------------------------------
const delay = (ms: number) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

/** Converte o vetor numérico na notação literal aceita pelo pgvector: [0.1,0.2,...] */
function vectorLiteral(values: number[]): string {
  return '[' + values.map((v) => String(v)).join(',') + ']';
}

/** String consolidada que alimenta o embedding (e a coluna `content`). */
function buildContent(req: Requisito): string {
  return `${req.code} - ${req.description}`;
}

/** Backoff exponencial com teto (ex.: 2s → 4s → 8s → 15s). */
function backoffMs(attempt: number): number {
  return Math.min(2000 * 2 ** (attempt - 1), 15000);
}

function isTransientError(err: any): boolean {
  const status = err?.status ?? err?.statusCode;
  if (status === 429 || (status >= 500 && status < 600)) return true;
  return typeof err?.message === 'string' && err.message.includes('429');
}

function maskUrl(url: string): string {
  return url.replace(/:([^:@]+)@/, ':***@');
}

// ----------------------------------------------------------------------------
// Camada de Embeddings (com proteção contra 429)
// ----------------------------------------------------------------------------

/**
 * Gera embeddings para um lote de textos.
 * Estratégia: `embedMany` (1 chamada por lote). Em falha persistente, cai para
 * `embed` item-a-item, inserindo apenas os que conseguirem ser vetorizados.
 * Retorna um array com a mesma ordem de `values` (null = falhou permanentemente).
 */
async function embedBatch(
  model: EmbeddingModel,
  values: string[]
): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = new Array(values.length).fill(null);

  // 1) Tentativa em lote (embedMany) com backoff exponencial.
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { embeddings } = await embedMany({ model, values, maxRetries: 0 });
      embeddings.forEach((vec, i) => {
        results[i] = vec;
      });
      return results;
    } catch (err: any) {
      // Erros permanentes (ex.: 400) não melhoram com retry — segue ao fallback.
      if (!isTransientError(err)) {
        console.warn(
          `  [embedMany] Erro permanente (${err?.status ?? 'erro'}): ${err?.message ?? err} — item-a-item.`
        );
        break;
      }
      const wait = backoffMs(attempt);
      console.warn(
        `  [embedMany] Falha transitória na tentativa ${attempt}/${MAX_ATTEMPTS} (${err?.status ?? 'erro'}): ${err?.message ?? err} — aguardando ${wait / 1000}s...`
      );
      await delay(wait);
    }
  }

  // 2) Fallback item-a-item (isola o requisito problemático).
  console.warn('  [embedMany] Esgotado — migrando para embedding individual (item-a-item).');
  for (let i = 0; i < values.length; i++) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { embedding } = await embed({ model, value: values[i], maxRetries: 0 });
        results[i] = embedding;
        break;
      } catch (err: any) {
        // Erro permanente (ex.: 400) — marca falha e segue para o próximo item.
        if (!isTransientError(err)) {
          console.warn(`  [embed] item[${i}] erro permanente: ${err?.message ?? err}`);
          break;
        }
        const wait = backoffMs(attempt);
        console.warn(
          `  [embed] item[${i}] tentativa ${attempt}/${MAX_ATTEMPTS} (${err?.status ?? 'erro'}): ${err?.message ?? err} — aguardando ${wait / 1000}s...`
        );
        await delay(wait);
      }
    }
  }

  return results;
}

// ----------------------------------------------------------------------------
// Orquestrador principal
// ----------------------------------------------------------------------------
async function main() {
  const startedAt = Date.now();
  const dryRun = process.argv.includes('--dry-run');
  dotenv.config({ path: '.env.local' });
  dotenv.config();

  console.log('══════════════════════════════════════════════════════════════');
  console.log(' SEED PRODUÇÃO RAG — Base de Conhecimento Vetorial');
  console.log(` Modelo: ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS} dimensões)`);
  console.log(` Origem: ${SOURCE_LABEL}`);
  console.log(` Lote: ${BATCH_SIZE}/vez | Delay entre lotes: ${DELAY_BETWEEN_BATCHES_MS / 1000}s`);
  console.log(` Modo: ${dryRun ? 'DRY-RUN (nenhuma escrita no banco)' : 'PRODUÇÃO'}`);
  console.log('══════════════════════════════════════════════════════════════');

  // 1) Chave de API para embeddings (mesmas variáveis da aplicação).
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey || apiKey.includes('your_')) {
    console.error('[FATAL] GEMINI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY não configurada.');
    process.exit(1);
  }

  // 2) Conexão com o banco via Prisma (driver adapter pg — mesmo padrão da app).
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[FATAL] DIRECT_URL / DATABASE_URL não configurada.');
    process.exit(1);
  }
  console.log(`[DB] Conectando em ${maskUrl(connectionString)}`);
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[DB] Conexão estabelecida com sucesso.');
  } catch (err) {
    console.error('[FATAL] Falha na conexão com o banco:', err);
    process.exit(1);
  }

  // 3) Carrega e valida o arquivo de requisitos.
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`[FATAL] Arquivo de requisitos não encontrado: ${DATA_FILE}`);
    console.error('        Crie o arquivo data/requisitos-sd.json com um array de');
    console.error('        { "code": "VIVO.SEGURA.AUT.01", "description": "..." }.');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  if (!Array.isArray(raw)) {
    console.error('[FATAL] data/requisitos-sd.json deve ser um array de requisitos.');
    process.exit(1);
  }

  const requisitos: Requisito[] = raw.filter((item: any) => {
    if (typeof item?.code !== 'string' || item.code.trim() === '') {
      console.warn('[DADOS] Ignorando item sem "code" válido:', JSON.stringify(item));
      return false;
    }
    return true;
  });

  const counters: Counters = {
    total: requisitos.length,
    skippedExisting: 0,
    inserted: 0,
    dimsMismatch: 0,
    failed: 0,
  };
  console.log(`[DADOS] Carregados ${counters.total} requisitos de ${DATA_FILE}`);

  // 4) Idempotência: pré-carrega os títulos já existentes no banco.
  const existing = await prisma.$queryRaw<Array<{ title: string }>>`
    SELECT title FROM public.knowledge_articles`;
  const existingTitles = new Set(existing.map((r) => r.title));
  console.log(`[IDEMPOTÊNCIA] ${existingTitles.size} registros já existentes na base (serão pulados).`);

  if (dryRun) {
    console.log('\n[DRY-RUN] Nada será gravado. Resumo planejado acima.');
    console.log('[DRY-RUN] Requisitos já existentes a pular:', existingTitles.size);
    await prisma.$disconnect();
    return;
  }

  // 5) Modelo de embeddings (criado uma única vez).
  const embeddingModel = createGoogleGenerativeAI({ apiKey }).embedding(EMBEDDING_MODEL);
  console.log(`[EMBED] Modelo pronto: ${EMBEDDING_MODEL}\n`);

  // 6) Processamento em lotes.
  const totalBatches = Math.ceil(counters.total / BATCH_SIZE);
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const batch = requisitos.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
    console.log(`──────────────────────────────────────────────────────────────`);
    console.log(
      `[LOTE ${batchIndex + 1}/${totalBatches}] ${batch.length} requisito(s) — processando...`
    );

    // 6.1 Filtra os que já existem (idempotência) antes de gastar cota de embedding.
    const pending: Array<{ req: Requisito; content: string }> = [];
    for (const req of batch) {
      if (existingTitles.has(req.code)) {
        counters.skippedExisting += 1;
        console.log(`  SKIP (já existe)  ${req.code}`);
      } else {
        pending.push({ req, content: buildContent(req) });
      }
    }

    if (pending.length === 0) {
      console.log('  Nenhum item novo neste lote — seguindo.');
    } else {
      // 6.2 Gera os embeddings do lote (com retry + fallback).
      const vectors = await embedBatch(embeddingModel, pending.map((p) => p.content));

      // 6.3 Insere cada vetor (pgvector via Prisma raw query).
      for (let i = 0; i < pending.length; i++) {
        const { req, content } = pending[i];
        const vector = vectors[i];

        if (!vector) {
          counters.failed += 1;
          console.error(`  FALHA (sem embedding)  ${req.code}`);
          continue;
        }
        if (vector.length !== EMBEDDING_DIMENSIONS) {
          counters.dimsMismatch += 1;
          console.error(
            `  FALHA (dimensão ${vector.length} ≠ ${EMBEDDING_DIMENSIONS})  ${req.code}`
          );
          continue;
        }

        try {
          await prisma.$executeRaw`
            INSERT INTO public.knowledge_articles (title, source, content, embedding)
            VALUES (${req.code}, ${SOURCE_LABEL}, ${content}, ${vectorLiteral(vector)}::vector)
          `;
          existingTitles.add(req.code);
          counters.inserted += 1;
          console.log(`  OK   ${req.code}`);
        } catch (err: any) {
          counters.failed += 1;
          console.error(`  ERRO ao inserir  ${req.code}:`, err?.message ?? err);
        }
      }
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(
      `  → Acumulado: ${counters.inserted} inseridos | ${counters.skippedExisting} pulados | ${counters.failed} falhas | ${elapsed}s`
    );

    // 6.4 Delay entre lotes (proteção contra Rate Limit 429), exceto no último.
    if (batchIndex < totalBatches - 1) {
      console.log(`  Aguardando ${DELAY_BETWEEN_BATCHES_MS / 1000}s até o próximo lote...`);
      await delay(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  // 7) Resumo final.
  const totalElapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(' RESULTADO FINAL DO SEED');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  Total de requisitos no arquivo : ${counters.total}`);
  console.log(`  Inseridos com sucesso          : ${counters.inserted}`);
  console.log(`  Pulados (já existiam)          : ${counters.skippedExisting}`);
  console.log(`  Falhas de dimensão (≠3072)     : ${counters.dimsMismatch}`);
  console.log(`  Falhas permanentes             : ${counters.failed}`);
  console.log(`  Tempo total                    : ${totalElapsed}s`);
  console.log('══════════════════════════════════════════════════════════════');

  await prisma.$disconnect();

  // Exit code: 0 = sucesso total; 1 = houve falhas permanentes (para CI).
  process.exit(counters.failed > 0 ? 1 : 0);
}

// Encerramento gracioso (Ctrl+C) para não deixar conexões abertas.
process.on('SIGINT', async () => {
  console.log('\n[ABORTADO] Ctrl+C recebido — encerrando conexões...');
  process.exit(130);
});

main().catch(async (err) => {
  console.error('[FATAL] Falha não tratada no seed:', err);
  process.exit(1);
});
