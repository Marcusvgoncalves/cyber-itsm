/**
 * Centro de Security QA — Motor Multiagente de Análise (server-only).
 *
 * Lógica pesada extraída da antiga rota síncrona /api/qa-engine e movida para
 * o worker de background (Inngest). Pipeline:
 *   Roteador Multiagente (Groq -> OpenRouter -> Google Gemini) → generateObject
 *   com schema Zod → fallback determinístico se todas as APIs falharem.
 *
 * Rate Limit: se TODOS os provedores falharem com 429, a engine lança
 * `QaRateLimitError` para que o Inngest re-agende (RetryAfterError) em poucos
 * segundos — nunca gera um laudo "baixa fidelidade" por pressa.
 */
import { generateObject, generateText, type LanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { prisma } from './prisma';
import type { QaAnalysis, QaFinding } from './types';

/** Lançado quando todas as APIs de LLM retornam Rate Limit (429). */
export class QaRateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(message = 'Todas as APIs de LLM retornaram Rate Limit (429)', retryAfterMs = 15_000) {
    super(message);
    this.name = 'QaRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

function resolveApiKey(names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim() !== '' && !value.includes('your_')) {
      return value.trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

type ModelFactory = (apiKey: string) => (modelId: string) => LanguageModel;

const GROQ: ModelFactory = (apiKey) => {
  const provider = createOpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });
  return (modelId) => provider(modelId);
};

const OPENROUTER: ModelFactory = (apiKey) => {
  const provider = createOpenRouter({ apiKey });
  return (modelId) => provider(modelId);
};

const GOOGLE: ModelFactory = (apiKey) => {
  const provider = createGoogleGenerativeAI({ apiKey });
  return (modelId) => provider(modelId);
};

const OPENAI: ModelFactory = (apiKey) => {
  const provider = createOpenAI({ apiKey });
  return (modelId) => provider(modelId);
};

interface AgentConfig {
  id: string;
  label: string;
  envKeys: string[];
  modelIds: string[];
  createModel: ModelFactory;
}

const AGENTS: AgentConfig[] = [
  {
    id: 'google',
    label: 'Google (Gemini 2.0 Flash / Lite)',
    envKeys: ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_API_KEY'],
    modelIds: ['gemini-2.0-flash', 'gemini-2.0-flash-lite'],
    createModel: GOOGLE,
  },
  {
    id: 'openai',
    label: 'OpenAI (GPT-4o Mini)',
    envKeys: ['OPENAI_API_KEY'],
    modelIds: ['gpt-4o-mini'],
    createModel: OPENAI,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (Gemini & Llama)',
    envKeys: ['OPENROUTER_API_KEY'],
    modelIds: [
      'meta-llama/llama-3.1-8b-instruct',
      'google/gemini-2.0-flash-001',
      'qwen/qwen-2.5-coder-32b-instruct',
    ],
    createModel: OPENROUTER,
  },
  {
    id: 'groq',
    label: 'Groq (Llama 3.1 8B / 3.3 70B)',
    envKeys: ['GROQ_API_KEY'],
    modelIds: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'],
    createModel: GROQ,
  },
];

// Migração de jsonSchema() para z.object() para máxima compatibilidade multi-LLM (Groq/OpenRouter)
const ANALYSIS_SCHEMA = z.object({
  compliancePercent: z.number().min(0).max(100).describe("Porcentagem geral de conformidade (0 a 100)"),
  overallRating: z.enum(['baixo', 'medio', 'alto', 'critico']).describe("Risco global baseado na porcentagem"),
  executiveSummary: z.string().describe("Sumário executivo em português (pt-BR), máximo 150 palavras"),
  findings: z.array(
    z.object({
      requirementId: z.string().describe("ID do requisito fornecido (ex: CYBER.SEGURA.X)"),
      requirementName: z.string().describe("Nome descritivo do requisito"),
      status: z.enum(['conforme', 'parcial', 'nao_conforme']).describe("Status de atendimento da evidência"),
      evidence: z.string().describe("A evidência técnica detalhada extraída do relatório"),
      recommendation: z.string().describe("A recomendação técnica específica para correção"),
    })
  ).describe("Lista de resultados, uma para cada requisito do escopo"),
});

const SYSTEM_PROMPT = `Você é um Engenheiro de AppSec Sênior. Sua tarefa é analisar o relatório de vulnerabilidades e propor SOLUÇÕES TÉCNICAS DIRETAS.
Sua missão é CRUZAR, um a um, TODOS os requisitos de arquitetura segura fornecidos no escopo com as vulnerabilidades e evidências encontradas no relatório de segurança (JSON/XML/TXT).

REGRAS OBRIGATÓRIAS:
1. É TERMINANTEMENTE PROIBIDO omitir ou resumir a lista de requisitos. Se o escopo contiver N requisitos, você DEVE obrigatoriamente retornar N itens no array 'findings', um para cada requisito fornecido.
2. Avalie cada requisito do escopo e classifique em "conforme", "parcial" ou "nao_conforme".
3. Para CADA requisito 'Não conforme' ou 'Parcial', você é OBRIGADO a fornecer em 'recommendation' o comando exato, a configuração de código ou o ajuste de infraestrutura necessário para sanar a falha. PROIBIDO usar verbos genéricos como 'Implantar', 'Verificar' ou 'Corrigir'. Diga exatamente COMO corrigir (ex: 'Altere a diretiva no nginx.conf para add_header Strict-Transport-Security...' ou 'No Prisma, adicione @default(uuid())').
4. Em 'evidence': Extrair e descrever o exato achado técnico presente no arquivo de origem que causou a reprovação ou atestou a conformidade.
5. compliancePercent = (requisitos conforme + 0.5 * requisitos parcial) / total de requisitos * 100, arredondado para 1 casa decimal.
6. overallRating: < 50 => "critico" | 50 a 69 => "alto" | 70 a 84 => "medio" | >= 85 => "baixo".
7. executiveSummary: sumário executivo em português (pt-BR), máximo 150 palavras.
8. Para cada finding, use requirementId exatamente como citado no escopo.
9. Você deve obrigatoriamente retornar todos os dados em um objeto JSON válido.`;

/** Detecta erros de Rate Limit (HTTP 429) a partir de qualquer provider AI SDK. */
export function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: unknown })?.status ?? (err as { responseStatus?: unknown })?.responseStatus;
  return status === 429 || /rate\s?limit|too many requests|429|quota/i.test(message);
}

/** Sanitiza texto não estruturado (controle, espaços) antes de persistir/enviar ao LLM. */
export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export interface SystemContext {
  totalTickets: number;
  totalProjects: number;
  avgCompliance: number;
}

/** Motor de análise determinístico de fallback (Parser Estruturado JSON/XML). */
export function generateFallbackAnalysis(
  requirementsText: string,
  evidenceText: string,
  sysCtx?: SystemContext
): QaAnalysis {
  const reqLines = requirementsText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 1) Tentar parsear a evidência como JSON estruturado
  let parsedJson: any = null;
  try {
    parsedJson = JSON.parse(evidenceText);
  } catch {
    parsedJson = null;
  }

  // Se for objeto/array JSON, achar lista de achados/requisitos avaliados
  let jsonItems: any[] = [];
  if (parsedJson) {
    if (Array.isArray(parsedJson)) {
      jsonItems = parsedJson;
    } else if (typeof parsedJson === 'object') {
      jsonItems =
        parsedJson.evaluatedRequirements ||
        parsedJson.findings ||
        parsedJson.results ||
        parsedJson.requirements ||
        parsedJson.items ||
        parsedJson.vulnerabilities ||
        parsedJson.issues ||
        [];
    }
  }

  const findings: QaFinding[] = reqLines.map((reqLine, idx) => {
    const idMatch = reqLine.match(/([A-Z0-9._-]+)/i);
    const reqId = idMatch ? idMatch[1] : `REQ-${idx + 1}`;
    const name = reqLine.length > 40 ? reqLine.slice(0, 40) + '...' : reqLine;

    let status: 'conforme' | 'parcial' | 'nao_conforme' = 'nao_conforme';
    let evidenceStr = `Nenhum detalhe técnico localizado no arquivo para o requisito ${reqId}.`;
    const recStr = `Consultar os logs da pipeline DevSecOps e o código-fonte correspondente à tag/ID ${reqId} para aplicar a remediação técnica.`;

    let foundInJson = false;

    // A) Parser Estruturado JSON
    if (jsonItems.length > 0) {
      const match = jsonItems.find((item) => {
        const itemCode = String(
          item.requirementCode || item.requirementId || item.id || item.code || item.ruleId || ''
        ).toLowerCase();
        const itemTitle = String(
          item.title || item.name || item.requirementName || ''
        ).toLowerCase();
        return (
          (itemCode && reqId.toLowerCase().includes(itemCode)) ||
          (itemCode && itemCode.includes(reqId.toLowerCase())) ||
          (itemTitle && name.toLowerCase().includes(itemTitle))
        );
      });

      if (match) {
        foundInJson = true;
        const detailsVal =
          match.details ||
          match.description ||
          match.evidence ||
          match.reason ||
          match.finding ||
          match.message ||
          match.summary;
        if (detailsVal && typeof detailsVal === 'string') {
          evidenceStr = detailsVal.trim();
        } else if (detailsVal) {
          evidenceStr = JSON.stringify(detailsVal);
        } else {
          evidenceStr = `Registro de evidência estruturada identificado no JSON para o requisito ${reqId}.`;
        }

        const rawStatus = String(match.status || match.verdict || '').toLowerCase();
        if (rawStatus.includes('conforme') && !rawStatus.includes('nao') && !rawStatus.includes('parcial')) {
          status = 'conforme';
        } else if (rawStatus.includes('parcial')) {
          status = 'parcial';
        } else if (match.passed === true) {
          status = 'conforme';
        } else {
          status = 'nao_conforme';
        }
      }
    }

    // B) Parser Estruturado XML (se não encontrou em JSON)
    if (!foundInJson) {
      const xmlFindingRegex = new RegExp(
        `<Finding[^>]*requirementCode=["']?([^"'>\\s]*${reqId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"'>\\s]*)["']?[^>]*>([\\s\\S]*?)</Finding>`,
        'i'
      );
      const xmlMatch = evidenceText.match(xmlFindingRegex);

      if (xmlMatch) {
        const findingBlock = xmlMatch[2];
        const detailsMatch = findingBlock.match(/<Details>([\s\S]*?)<\/Details>/i) || findingBlock.match(/<Description>([\s\S]*?)<\/Description>/i);
        if (detailsMatch && detailsMatch[1].trim()) {
          evidenceStr = detailsMatch[1].trim();
        } else {
          evidenceStr = `Achado técnico extraído da tag <Finding> do XML para o requisito ${reqId}.`;
        }

        const statusMatch = findingBlock.match(/status=["']?([^"'>\s]+)["']?/i) || findingBlock.match(/<Status>([^<]+)<\/Status>/i);
        const rawStatus = statusMatch ? statusMatch[1].toLowerCase() : '';
        if (rawStatus.includes('conforme') && !rawStatus.includes('nao') && !rawStatus.includes('parcial')) {
          status = 'conforme';
        } else if (rawStatus.includes('parcial')) {
          status = 'parcial';
        } else {
          status = 'nao_conforme';
        }
      } else {
        const reqIndex = evidenceText.indexOf(reqId);
        if (reqIndex !== -1) {
          const snippet = evidenceText.slice(Math.max(0, reqIndex - 100), Math.min(evidenceText.length, reqIndex + 400));
          const detailsSnippetMatch = snippet.match(/<Details>([\s\S]*?)<\/Details>/i);
          if (detailsSnippetMatch && detailsSnippetMatch[1].trim()) {
            evidenceStr = detailsSnippetMatch[1].trim();
          }
        }
      }
    }

    return {
      requirementId: reqId,
      requirementName: name,
      status,
      evidence: evidenceStr,
      recommendation: recStr,
    };
  });

  const conformeCount = findings.filter((f) => f.status === 'conforme').length;
  const parcialCount = findings.filter((f) => f.status === 'parcial').length;
  const total = findings.length || 1;

  const compliancePercent = Math.round(((conformeCount + 0.5 * parcialCount) / total) * 1000) / 10;

  let overallRating: QaAnalysis['overallRating'] = 'baixo';
  if (compliancePercent < 50) overallRating = 'critico';
  else if (compliancePercent < 70) overallRating = 'alto';
  else if (compliancePercent < 85) overallRating = 'medio';

  const ticketsCtx = sysCtx ? ` O ecossistema possui ${sysCtx.totalTickets} atividades/tarefas registradas pelos usuários, com ${sysCtx.totalProjects} projetos sob governança e um compliance histórico médio de ${sysCtx.avgCompliance.toFixed(1)}%.` : '';

  return {
    compliancePercent,
    overallRating,
    executiveSummary: `Análise realizada pelo motor determinístico de contingência sobre ${findings.length} requisitos. Índice de conformidade em ${compliancePercent}%. Foram identificados ${findings.filter((f) => f.status === 'nao_conforme').length} itens não conformes.${ticketsCtx} Esta avaliação foi correlacionada com as interações globais da plataforma para apoio à arquitetura.`,
    findings,
  };
}

export interface RunQaAnalysisOptions {
  allowFallback?: boolean;
}

export interface RunQaAnalysisResult {
  analysis: QaAnalysis;
  activeAgentLabel: string;
  failures: string[];
}

export async function runQaAnalysis(
  requirements: string,
  evidence: string,
  onStatus?: (message: string) => void,
  options?: RunQaAnalysisOptions
): Promise<RunQaAnalysisResult> {
  const failures: string[] = [];
  let rateLimited = false;

  // Loop do Roteador Multiagente
  for (const agent of AGENTS) {
    const apiKey = resolveApiKey(agent.envKeys);
    if (!apiKey) {
      failures.push(`${agent.label}: chave ausente`);
      continue;
    }

    const modelFactory = agent.createModel(apiKey);

    for (const modelId of agent.modelIds) {
      const startTime = Date.now();
      try {
        onStatus?.(`Analisando evidências via ${agent.label} (${modelId})...`);

        let genRes: { object: any; usage?: any };
        try {
          genRes = await generateObject({
            model: modelFactory(modelId),
            schema: ANALYSIS_SCHEMA,
            system: SYSTEM_PROMPT,
            prompt: `[REQUISITOS]\n${requirements}\n\n[RELATÓRIO DE SEGURANÇA]\n${evidence}\n\nCruce os requisitos com as evidências e devolva o JSON conforme o schema.`,
            temperature: 0.25,
            maxOutputTokens: 4096,
            maxRetries: 0,
            abortSignal: AbortSignal.timeout(6000),
          });
        } catch (sdkErr) {
          const errMsg = sdkErr instanceof Error ? sdkErr.message : String(sdkErr);
          if (isRateLimitError(sdkErr)) {
            throw sdkErr;
          }
          if (errMsg.includes('json_schema') || agent.id === 'groq') {
            console.log(`[Security QA Engine] Modelo '${modelId}' requer fallback via generateText JSON...`);
            const textRes = await generateText({
              model: modelFactory(modelId),
              system: SYSTEM_PROMPT,
              prompt: `[REQUISITOS]\n${requirements}\n\n[RELATÓRIO DE SEGURANÇA]\n${evidence}\n\nRetorne ESTRITAMENTE um objeto JSON válido no formato:\n{\n  "compliancePercent": number,\n  "overallRating": "baixo"|"medio"|"alto"|"critico",\n  "executiveSummary": string,\n  "findings": [{ "requirementId": string, "requirementName": string, "status": "conforme"|"parcial"|"nao_conforme", "evidence": string, "recommendation": string }]\n}`,
              temperature: 0.25,
              maxOutputTokens: 4096,
              maxRetries: 0,
              abortSignal: AbortSignal.timeout(6000),
            });

            const jsonMatch = textRes.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsedObj = JSON.parse(jsonMatch[0]);
              genRes = { object: parsedObj, usage: textRes.usage };
            } else {
              throw sdkErr;
            }
          } else {
            throw sdkErr;
          }
        }

        if (genRes.object && typeof (genRes.object as { compliancePercent?: unknown }).compliancePercent === 'number') {
          let analysis = genRes.object as QaAnalysis;

          // REFORÇO DE COBERTURA 100%: Garante que TODOS os requisitos do escopo estejam presentes no laudo!
          const inputReqLines = requirements
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0);

          const existingFindings = Array.isArray(analysis.findings) ? analysis.findings : [];

          // Mapeia cada linha de requisito do escopo para garantir cobertura total (sem omissões do LLM)
          const fullFindings: QaFinding[] = inputReqLines.map((reqLine, idx) => {
            const idMatch = reqLine.match(/([A-Z0-9._-]+)/i);
            const reqId = idMatch ? idMatch[1] : `REQ-${idx + 1}`;
            const reqName = reqLine.length > 40 ? reqLine.slice(0, 40) + '...' : reqLine;

            const existing = existingFindings.find(
              (f) =>
                f.requirementId &&
                (f.requirementId.toLowerCase() === reqId.toLowerCase() ||
                 reqId.toLowerCase().includes(f.requirementId.toLowerCase()) ||
                 (f.requirementName && reqLine.toLowerCase().includes(f.requirementName.toLowerCase())))
            );

            if (existing) {
              return {
                requirementId: existing.requirementId || reqId,
                requirementName: existing.requirementName || reqName,
                status: existing.status || 'nao_conforme',
                evidence: existing.evidence || `Achado técnico avaliado para o controle ${reqId}.`,
                recommendation: existing.recommendation || `Consultar os logs da pipeline DevSecOps e o código-fonte correspondente à tag/ID ${reqId} para aplicar a remediação técnica.`,
              };
            }

            return {
              requirementId: reqId,
              requirementName: reqName,
              status: 'nao_conforme',
              evidence: `Requisito ${reqId} não teve evidência conclusiva extraída na avaliação parcial do LLM.`,
              recommendation: `Consultar os logs da pipeline DevSecOps e o código-fonte correspondente à tag/ID ${reqId} para aplicar a remediação técnica.`,
            };
          });

          // Recalcula compliance global com base nos requisitos completos do escopo
          const conformeCount = fullFindings.filter((f) => f.status === 'conforme').length;
          const parcialCount = fullFindings.filter((f) => f.status === 'parcial').length;
          const totalReqs = fullFindings.length || 1;
          const updatedCompliance = Math.round(((conformeCount + 0.5 * parcialCount) / totalReqs) * 1000) / 10;

          let updatedRating: QaAnalysis['overallRating'] = 'baixo';
          if (updatedCompliance < 50) updatedRating = 'critico';
          else if (updatedCompliance < 70) updatedRating = 'alto';
          else if (updatedCompliance < 85) updatedRating = 'medio';

          analysis = {
            ...analysis,
            findings: fullFindings,
            compliancePercent: updatedCompliance,
            overallRating: updatedRating,
          };

          const activeAgentLabel = `${agent.label} (${modelId})`;
          console.log(`[Security QA Engine] Sucesso com agente: ${activeAgentLabel} (Cobertura: ${fullFindings.length}/${inputReqLines.length} requisitos)`);

          const latencyMs = Date.now() - startTime;
          const tokensUsed = genRes.usage?.totalTokens ?? 1500;
          let costEst = 0;
          if (agent.id === 'google') costEst = (tokensUsed / 1000) * 0.000075;
          else if (agent.id === 'openai') costEst = (tokensUsed / 1000) * 0.00015;

          await prisma.llmCallLog.create({
            data: {
              provider: agent.id,
              model: modelId,
              route: '/api/qa-engine',
              status: 'SUCESSO',
              latencyMs,
              tokensUsed,
              costEst,
            }
          }).catch((e) => console.error("Falha ao salvar log de LLM:", e));

          return { analysis, activeAgentLabel, failures };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isRateLimitError(err)) rateLimited = true;
        failures.push(`${agent.label} (${modelId}): ${msg}`);
        console.warn(`[Security QA Engine] Falha no modelo "${modelId}": ${msg}. Tentando próximo...`);

        const latencyMs = Date.now() - startTime;
        await prisma.llmCallLog.create({
          data: {
            provider: agent.id,
            model: modelId,
            route: '/api/qa-engine',
            status: 'FALHA',
            latencyMs,
            tokensUsed: 0,
            costEst: 0,
          }
        }).catch((e) => console.error("Falha ao salvar log de LLM:", e));
      }
    }
  }

  // Se todos os provedores LLM falharem por Rate Limit e fallback não estiver forçado:
  // Lança exceção para o Inngest realizar o retry com exponential backoff na fila!
  if (rateLimited && !options?.allowFallback) {
    throw new QaRateLimitError("Rate limit exceeded across LLM providers. Retrying via Inngest backoff...", 15_000);
  }

  // Fallback determinístico (acionado quando retentativas se esgotam ou em falhas definitivas).
  const summary = failures.join(' | ');
  console.warn(
    `[Security QA Engine] Nenhum provedor LLM respondeu com sucesso (${summary}). Executando motor determinístico de segurança...`
  );
  onStatus?.('Executando motor de análise determinística de segurança (fallback)...');

  // Busca dados consolidados das interações reais dos usuários no banco
  const [totalTickets, totalProjects, avgRes] = await Promise.all([
    prisma.ticket.count().catch(() => 0),
    prisma.qaProject.count().catch(() => 0),
    prisma.qaResult
      .aggregate({ _avg: { compliancePercent: true } })
      .catch(() => ({ _avg: { compliancePercent: null } })),
  ]);

  const avgCompliance =
    avgRes?._avg?.compliancePercent != null ? Number(avgRes._avg.compliancePercent) : 85.0;

  const sysCtx: SystemContext = {
    totalTickets,
    totalProjects,
    avgCompliance
  };

  const fallbackAnalysis = generateFallbackAnalysis(requirements, evidence, sysCtx);
  if (rateLimited) {
    fallbackAnalysis.executiveSummary += ' [Nota: Análise executada via motor de regras determinístico de contingência devido a instabilidade temporária nas APIs de LLM].';
  }

  await prisma.llmCallLog.create({
    data: {
      provider: 'fallback',
      model: 'motor-deterministico',
      route: '/api/qa-engine',
      status: 'FALLBACK',
      latencyMs: 150,
      tokensUsed: 0,
      costEst: 0,
    }
  }).catch((e) => console.error("Falha ao salvar log de LLM:", e));

  return {
    analysis: fallbackAnalysis,
    activeAgentLabel: 'motor-deterministico',
    failures,
  };
}
