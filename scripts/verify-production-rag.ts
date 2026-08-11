/**
 * ============================================================================
 * VERIFY PRODUCTION RAG — Sanity Check (Read-Only)
 * ============================================================================
 * Atesta que o RAG de produção responde com base nos 314 requisitos reais
 * injetados em `public.knowledge_articles` (Supabase/pgvector).
 *
 * Execução ESTRITAMENTE via terminal (Node.js/TSX) — script 100% isolado,
 * impacto ZERO na aplicação em produção.
 *
 *   npx --yes tsx scripts/verify-production-rag.ts
 *
 * Esta operação é SOMENTE LEITURA (Read-Only):
 *   - nenhum INSERT, UPDATE, DELETE ou expurgo é executado;
 *   - apenas SELECT + chamadas de IA (embedding e síntese de resposta).
 *
 * Fluxo:
 *   1. Instancia o gerador de embeddings `gemini-embedding-2` (3072 dimensões);
 *   2. Embuti a pergunta (Ground Truth) de criptografia em trânsito / TLS / gateway;
 *   3. Busca de Cosine Similarity (operador `<=>` do pgvector) — Top 4;
 *   4. Auditoria no terminal dos títulos (códigos) retornados (expectativa
 *      da família `CYBER.SEGURA.CRIP.*`);
 *   5. Envia o contexto recuperado + pergunta para a esteira multiagente
 *      (`routeToModel`) e exibe a resposta final sintetizada.
 * ============================================================================
 */

import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../lib/generated/prisma/client';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed } from 'ai';
import { routeToModel } from '../lib/llm/agent-router';

// ----------------------------------------------------------------------------
// Configuração do script
// ----------------------------------------------------------------------------
const EMBEDDING_MODEL = 'gemini-embedding-2';
const EMBEDDING_DIMENSIONS = 3072;
const TOP_K = 4;
const EXPECTED_PREFIXES = ['CYBER.SEGURA.CRIP.', 'CYBER.SEGURA.APIS.', 'CYBER.SEGURA.APLICAÇÃO.'];
function isRelevantReq(title: string): boolean {
  return EXPECTED_PREFIXES.some((prefix) => title.startsWith(prefix));
}

/** Pergunta estrita (Ground Truth) validada pelo QA contra a matriz real. */
const GROUND_TRUTH_QUESTION =
  'Quais são os nossos requisitos internos obrigatórios para criptografia em trânsito, versão de TLS e proteção de gateway?';

// ----------------------------------------------------------------------------
// Cores ANSI para destaque no terminal
// ----------------------------------------------------------------------------
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// ----------------------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------------------
interface RAGResultRow {
  title: string;
  source: string;
  content: string;
  distance: number;
}

function vectorLiteral(values: number[]): string {
  return '[' + values.map((v) => String(v)).join(',') + ']';
}

function maskUrl(url: string): string {
  return url.replace(/:([^:@]+)@/, ':***@');
}

// ----------------------------------------------------------------------------
// Orquestrador principal (Read-Only)
// ----------------------------------------------------------------------------
async function main() {
  dotenv.config({ path: '.env.local' });
  dotenv.config();

  console.log('══════════════════════════════════════════════════════════════');
  console.log(' VERIFY PRODUCTION RAG — Sanity Check (Read-Only)');
  console.log(` Modelo de embedding : ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS} dims)`);
  console.log(` Top-K               : ${TOP_K}`);
  console.log(` Família esperada    : ${EXPECTED_PREFIXES.join(', ')}`);
  console.log('══════════════════════════════════════════════════════════════');

  // 1) Chave de API (mesmas variáveis da aplicação/seed).
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
    await pool.end().catch(() => {});
    process.exit(1);
  }

  // 3) Sanidade: confirma que a base vetorial está populada.
  const totalRows = await prisma.$queryRaw<Array<{ count: string }>>`
    SELECT COUNT(*)::text AS count FROM public.knowledge_articles`;
  const total = Number(totalRows[0]?.count ?? 0);
  if (total === 0) {
    console.error(
      '[FALHA] Tabela knowledge_articles vazia. Execute antes: npm run db:seed:rag'
    );
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`[DADOS] Base vetorial populada: ${total} artigo(s) em knowledge_articles.\n`);

  // 4) Instancia o modelo de embeddings e gera o vetor da pergunta (Ground Truth).
  const embeddingModel = createGoogleGenerativeAI({ apiKey }).embedding(EMBEDDING_MODEL);
  console.log(`[QUERY] Ground Truth: "${GROUND_TRUTH_QUESTION}"`);
  const { embedding: questionVector } = await embed({
    model: embeddingModel,
    value: GROUND_TRUTH_QUESTION,
    maxRetries: 2,
  });
  if (questionVector.length !== EMBEDDING_DIMENSIONS) {
    console.error(
      `[FALHA] Embedding da pergunta com ${questionVector.length} dims (esperado ${EMBEDDING_DIMENSIONS}).`
    );
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`[QUERY] Vetor gerado: ${questionVector.length} dimensões.\n`);

  // 5) Busca de Cosine Similarity (operador `<=>` do pgvector) — Top K.
  console.log(`[RAG] Buscando Top ${TOP_K} por similaridade de cosseno...`);
  const results = await prisma.$queryRaw<RAGResultRow[]>`
    SELECT title, source, content,
           embedding <=> ${vectorLiteral(questionVector)}::vector AS distance
    FROM public.knowledge_articles
    WHERE embedding IS NOT NULL
    ORDER BY distance ASC
    LIMIT ${TOP_K}
  `;

  if (results.length === 0) {
    console.error('[FALHA] Nenhum resultado retornado pela busca vetorial.');
    await prisma.$disconnect();
    process.exit(1);
  }

  // 6) Auditoria no terminal dos títulos (códigos) retornados.
  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(`${C.bold}RAW SEARCH RESULTADOS (títulos/códigos retornados pelo pgvector)${C.reset}`);
  console.log('──────────────────────────────────────────────────────────────');
  results.forEach((row, index) => {
    const isExpectedFamily = isRelevantReq(row.title);
    const badge = isExpectedFamily ? `${C.green}✓ REQUISITO DE SEGURANÇA${C.reset}` : `${C.yellow}?${C.reset}`;
    console.log(
      `  #${index + 1}  ${badge}  ${C.cyan}${row.title}${C.reset}  ` +
        `(distance: ${row.distance.toFixed(6)})`
    );
    console.log(`      source : ${row.source}`);
    console.log(`      content: ${row.content.length > 180 ? row.content.slice(0, 180) + '…' : row.content}`);
  });

  const familyHits = results.filter((r) => isRelevantReq(r.title));
  console.log('\n[CHECK] Requisitos de Criptografia e Segurança recuperados:');
  if (familyHits.length > 0) {
    console.log(`  ${C.green}✓ ${familyHits.length}/${results.length} do Top ${TOP_K} pertencem às famílias de Criptografia/Segurança${C.reset}`);
    familyHits.forEach((r) => console.log(`    - ${r.title}`));
  } else {
    console.log(
      `  ${C.red}✗ Nenhum requisito de criptografia no Top ${TOP_K}.${C.reset}`
    );
  }

  // 7) Construção do contexto recuperado para a síntese da IA.
  const context = results
    .map(
      (row, index) =>
        `${index + 1}) ${row.title} [${row.source}]: ${row.content}`
    )
    .join('\n');

  const system = [
    'Você é o Especialista Sênior em Cibersegurança da plataforma CyberITSM SPN.',
    'Responda a pergunta do usuário SOMENTE com base nas regras internas da empresa recuperadas da base de conhecimento vetorial (contexto abaixo).',
    'Cite explicitamente os códigos de requisitos (ex.: CYBER.SEGURA.CRIP.*) e as regras da empresa.',
    'Não invente requisitos que não estejam no contexto fornecido.',
  ].join(' ');

  const prompt = [
    `PERGUNTA: ${GROUND_TRUTH_QUESTION}`,
    '',
    'CONTEXTO RECUPERADO (Top 4 — busca vetorial pgvector):',
    context,
    '',
    'Resposta esperada: uma síntese das regras obrigatórias da empresa para criptografia em trânsito, versão de TLS e proteção de gateway, citando os códigos de requisito.',
  ].join('\n');

  // 8) Síntese da resposta via esteira multiagente (routeToModel).
  console.log('\n──────────────────────────────────────────────────────────────');
  console.log(`${C.bold}SINTETIZANDO RESPOSTA COM A ESTEIRA MULTIAGENTE (routeToModel)${C.reset}`);
  console.log('──────────────────────────────────────────────────────────────');
  let answer: string;
  try {
    const result = await routeToModel(prompt, system);
    answer = result.response;
    console.log(`  ${C.dim}Provedor/Modelo: ${result.provider} / ${result.model}${C.reset}`);
  } catch (err: any) {
    console.error('[FALHA] Esteira multiagente indisponível:', err?.message ?? err);
    await prisma.$disconnect();
    process.exit(1);
  }

  // 9) Exibição em destaque da resposta final da IA.
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(`${C.magenta}${C.bold} RESPOSTA FINAL DA IA (regras internas da empresa)${C.reset}`);
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`\n${answer}\n`);

  // 10) Resumo do Sanity Check.
  const exitCode = familyHits.length > 0 ? 0 : 1;
  console.log('──────────────────────────────────────────────────────────────');
  console.log(`RESULTADO DO SANITY CHECK: ${exitCode === 0 ? 'APROVADO ✓' : 'REVISAR ✗'}`);
  console.log(`  - Base vetorial          : ${total} artigo(s) populado(s)`);
  console.log(`  - Top ${TOP_K} recuperado        : ${results.length} resultado(s)`);
  console.log(`  - Requisitos de Segurança: ${familyHits.length}/${results.length}`);
  console.log('  - Operação              : READ-ONLY (nenhum dado alterado/excluído)');
  console.log('──────────────────────────────────────────────────────────────');

  await prisma.$disconnect();
  process.exit(exitCode);
}

// Encerramento gracioso (Ctrl+C).
process.on('SIGINT', async () => {
  console.log('\n[ABORTADO] Ctrl+C recebido — encerrando conexões...');
  process.exit(130);
});

main().catch(async (err) => {
  console.error('[FATAL] Falha não tratada no verify-rag:', err);
  process.exit(1);
});
