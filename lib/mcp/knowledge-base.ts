import requisitosRaw from '@/requisitos-sd.json';

/**
 * ============================================================================
 * BASE DE CONHECIMENTO (RAG) — Motor de recuperação usado pela ferramenta MCP
 * `search_knowledge_base`.
 *
 * Duas camadas de recuperação, ambas 100% locais e sem custo:
 *
 *   1. CAMADA DETERMINÍSTICA (sempre ativa): busca léxica ponderada sobre a
 *      matriz de 314 Requisitos Segura SD v4.1 (`requisitos-sd.json`), a MESMA
 *      base usada pelo Copiloto hoje — zero risco, zero chamadas externas.
 *
 *   2. CAMADA VETORIAL pgvector (OPCIONAL, por env): busca de similaridade
 *      sobre `knowledge_articles` (embedding gemini-embedding-2, 3072 dims).
 *      Somente habilitada quando `MCP_RAG_USE_PGVECTOR=1` E uma chave Gemini
 *      está configurada. Qualquer falha nesta camada DEGRADA EM SILÊNCIO para
 *      a camada determinística (resiliência total).
 *
 * Este módulo é ADITIVO — não altera a rota existente do Copiloto.
 * ============================================================================
 */

/** Shape de um requisito da matriz Segura SD v4.1. */
export interface Requirement {
  id: string | null;
  controle: string | null;
  detalhamento: string | null;
  componente: string | null;
  propriedade: string | null;
  strideLM: string | null;
  riscos: string | null;
  owasp: string | null;
  categoria: string | null;
  criticidade: string | null;
  tipoControle: string | null;
  evidencia: string | null;
  comoTestar: string | null;
}

const REQUISITOS = requisitosRaw as Requirement[];

const STOPWORDS = new Set([
  'qual', 'quais', 'como', 'para', 'que', 'com', 'uma', 'um', 'das', 'dos', 'da', 'de', 'do', 'em',
  'oque', 'pode', 'posso', 'me', 'mais', 'mas', 'por', 'na', 'no', 'se', 'sobre', 'quero', 'saber',
  'falar', 'especifica', 'aplicar', 'ser', 'esta', 'este', 'estao', 'voce', 'contexto', 'chamado',
  'requisito', 'requisitos', 'favor', 'criar', 'abrir', 'quer',
]);

/** Normaliza e extrai tokens relevantes (acentos removidos, minúsculas). */
function tokenize(text: string): string[] {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const tokens = normalized.split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOPWORDS.has(t));
  return Array.from(new Set(tokens));
}

/**
 * Busca léxica ponderada sobre a matriz de requisitos.
 * Relevância: código/controle/componente/framework > detalhamento > criticidade.
 */
export function searchRequirementMatrix(
  query: string,
  limit = 6,
  context = '',
): Requirement[] {
  const queryTokens = [...tokenize(query), ...tokenize(context)];
  if (queryTokens.length === 0) return [];

  const scored = REQUISITOS.map((req) => {
    const core = [req.controle, req.componente, req.id, req.owasp, req.strideLM];
    const detail = [req.detalhamento, req.riscos, req.categoria, req.propriedade];
    const light = [req.criticidade];
    let score = 0;

    for (const token of queryTokens) {
      if (core.some((f) => f && tokenize(f).includes(token))) score += 3;
      if (detail.some((f) => f && tokenize(f).includes(token))) score += 2;
      if (light.some((f) => f && tokenize(f).includes(token))) score += 1;
    }
    return { req, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.req);
}

/** Busca exata (case-insensitive) por código de requisito. */
export function getRequirementByCode(code: string): Requirement | null {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  return REQUISITOS.find((req) => (req.id ?? '').toUpperCase() === normalized) ?? null;
}

/** Formata um requisito em texto estruturado (usado para enriquecer chamados). */
export function formatRequirement(req: Requirement): string {
  return [
    `[${req.id ?? 'S/ID'}] ${req.controle ?? ''}`,
    `  Detalhamento: ${req.detalhamento ?? 'N/A'}`,
    `  Componente: ${req.componente ?? 'N/A'} | Propriedade: ${req.propriedade ?? req.categoria ?? 'N/A'}`,
    `  STRIDE: ${req.strideLM ?? 'N/A'} | OWASP: ${req.owasp ?? 'N/A'}`,
    `  Riscos: ${req.riscos ?? 'N/A'}`,
    `  Categoria: ${req.categoria ?? 'N/A'} | Criticidade: ${req.criticidade ?? 'N/A'} | Tipo: ${req.tipoControle ?? 'N/A'}`,
  ].join('\n');
}

export interface KnowledgeSearchResult {
  id: string | null;
  controle: string | null;
  detalhamento: string | null;
  componente: string | null;
  propriedade: string | null;
  categoria: string | null;
  criticidade: string | null;
  owasp: string | null;
  strideLM: string | null;
  riscos: string | null;
}

/** Serializa um requisito para o payload estruturado retornado ao agente. */
function toSearchResult(req: Requirement): KnowledgeSearchResult {
  return {
    id: req.id,
    controle: req.controle,
    detalhamento: req.detalhamento,
    componente: req.componente,
    propriedade: req.propriedade,
    categoria: req.categoria,
    criticidade: req.criticidade,
    owasp: req.owasp,
    strideLM: req.strideLM,
    riscos: req.riscos,
  };
}

/**
 * Camada vetorial opcional (pgvector). Exige `MCP_RAG_USE_PGVECTOR=1` e chave
 * Gemini configurada. Falhas são capturadas e retornam `[]` — a camada
 * determinística assume o controle.
 */
async function searchPgvector(
  query: string,
  limit: number,
): Promise<KnowledgeSearchResult[]> {
  if (process.env.MCP_RAG_USE_PGVECTOR !== '1') return [];
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return [];

  try {
    const [{ prisma }, { embed }, { createGoogleGenerativeAI }] = await Promise.all([
      import('@/lib/security-qa/prisma'),
      import('ai'),
      import('@ai-sdk/google'),
    ]);

    const { embedding } = await embed({
      model: createGoogleGenerativeAI({ apiKey }).embedding('gemini-embedding-2'),
      value: query,
    });

    const vectorLiteral = `[${embedding.join(',')}]`;
    const rows = await prisma.$queryRaw<Array<{ id: string; title: string; source: string; content: string }>>`
      SELECT id, title, source, content
        FROM knowledge_articles
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> ${vectorLiteral}::vector
       LIMIT ${Math.min(limit, 10)}
    `;

    return rows.map((row) => ({
      id: row.id,
      controle: row.title,
      detalhamento: row.content.slice(0, 2000),
      componente: row.source,
      propriedade: null,
      categoria: null,
      criticidade: null,
      owasp: null,
      strideLM: null,
      riscos: null,
    }));
  } catch (err) {
    console.warn('[MCP RAG] Camada pgvector indisponível — degradando para matriz local:', err);
    return [];
  }
}

/**
 * Busca unificada na Base de Conhecimento.
 * Sempre retorna a camada determinística; adiciona a vetorial apenas se ativa.
 */
export async function searchKnowledgeBase(
  query: string,
  limit = 5,
): Promise<KnowledgeSearchResult[]> {
  const safeLimit = Math.max(1, Math.min(10, limit));
  const lexical = searchRequirementMatrix(query, safeLimit);
  const results = lexical.map(toSearchResult);

  if (process.env.MCP_RAG_USE_PGVECTOR === '1') {
    const vector = await searchPgvector(query, safeLimit);
    if (vector.length > 0) {
      const seen = new Set(results.map((r) => r.id ?? r.controle));
      return [...vector.filter((v) => !seen.has(v.id ?? v.controle)), ...results].slice(0, safeLimit);
    }
  }

  return results;
}
