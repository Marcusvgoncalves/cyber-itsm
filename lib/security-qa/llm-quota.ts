/**
 * Modelo de cota (quota) por provedor de LLM.
 *
 * Cada provedor free/pago expõe janelas de renovação de tokens distintas.
 * Este módulo centraliza o "quando os tokens renovam" e calcula, a partir dos
 * logs reais em `llm_call_logs`, o consumo dentro da janela vigente, o saldo
 * restante estimado e a projeção de exaustão da cota — tudo de forma
 * determinística (regras) e sem depender de APIs externas.
 */

export type LlmQuotaWindow = "daily" | "monthly";

export interface LlmQuotaConfig {
  /** Identificador do provedor em llm_call_logs (provider). */
  providerId: string;
  /** Janela de renovação de tokens: diária ou mensal. */
  window: LlmQuotaWindow;
  /** Hora UTC (0–23) em que a janela diária reinicia. */
  resetHourUtc: number;
  /** Dia do mês (1–28) para janela mensal. */
  resetDayOfMonth?: number;
  /** Limite estimado de tokens por janela (null = ilimitado/pago por uso). */
  tokenWindowLimit: number | null;
  /** Rótulo amigável da política. */
  policyLabel: string;
  /** Descrição do teto para exibição. */
  limitLabel: string;
}

/**
 * Políticas por provedor. Valores de teto representam o plano free/promo
 * vigente; ajuste conforme o contrato real da organização.
 */
export const LLM_QUOTA_POLICIES: LlmQuotaConfig[] = [
  {
    providerId: "google",
    window: "daily",
    resetHourUtc: 0,
    tokenWindowLimit: 1_000_000,
    policyLabel: "Renovação diária (00:00 UTC)",
    limitLabel: "~1M tokens/dia (free tier Gemini)",
  },
  {
    providerId: "openai",
    window: "monthly",
    resetHourUtc: 0,
    resetDayOfMonth: 1,
    tokenWindowLimit: 3_000_000,
    policyLabel: "Renovação mensal (1º dia do mês, 00:00 UTC)",
    limitLabel: "Budget mensal de referência",
  },
  {
    providerId: "openrouter",
    window: "daily",
    resetHourUtc: 0,
    tokenWindowLimit: 1_000_000,
    policyLabel: "Renovação diária (00:00 UTC)",
    limitLabel: "~1M tokens/dia (modelos free)",
  },
  {
    providerId: "groq",
    window: "daily",
    resetHourUtc: 0,
    tokenWindowLimit: 14_400,
    policyLabel: "Renovação diária (00:00 UTC)",
    limitLabel: "14.400 tokens/dia (free tier Groq)",
  },
];

export interface LlmQuotaUsage {
  providerId: string;
  windowLabel: string;
  /** Início da janela vigente. */
  windowStart: string;
  /** Próxima data/hora de renovação dos tokens. */
  nextRenewal: string;
  /** Renovação formatada (pt-BR). */
  nextRenewalLabel: string;
  /** Tokens consumidos na janela vigente. */
  windowTokensUsed: number;
  /** Teto da janela (null = sem teto). */
  tokenWindowLimit: number | null;
  /** % de uso da janela (0–100). */
  usagePct: number | null;
  /** Saldo restante estimado (null = sem teto). */
  remainingTokens: number | null;
  /** Projeção: data em que a cota seria exaurida no ritmo atual (null se não se exaurir). */
  projectedExhaustion: string | null;
  /** Percentual do tempo da janela já decorrido (0–100). */
  windowElapsedPct: number;
  policyLabel: string;
  limitLabel: string;
}

/** Retorna a política de cota de um provedor (default: sem teto, diária). */
export function getLlmQuotaPolicy(providerId: string): LlmQuotaConfig {
  return (
    LLM_QUOTA_POLICIES.find((p) => p.providerId === providerId) ?? {
      providerId,
      window: "daily",
      resetHourUtc: 0,
      tokenWindowLimit: null,
      policyLabel: "Sem janela definida",
      limitLabel: "Ilimitado / pago por uso",
    }
  );
}

/** Calcula o início da janela vigente (diária ou mensal) em UTC. */
export function getQuotaWindowStart(cfg: LlmQuotaConfig, now: Date = new Date()): Date {
  if (cfg.window === "monthly") {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), cfg.resetDayOfMonth ?? 1, 0, 0, 0)
    );
  }
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), cfg.resetHourUtc, 0, 0)
  );
}

/** Calcula a próxima renovação (fim da janela vigente). */
export function getNextRenewal(cfg: LlmQuotaConfig, now: Date = new Date()): Date {
  const start = getQuotaWindowStart(cfg, now);
  if (cfg.window === "monthly") {
    const startDate = new Date(start);
    const next = new Date(startDate);
    next.setUTCMonth(next.getUTCMonth() + 1);
    return next;
  }
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

const fmtPtBr = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/**
 * Calcula o consumo de tokens do provedor dentro da janela vigente e a data
 * de renovação. `logs` deve ser a lista de chamadas (llm_call_logs) já filtrada
 * por provedor, com o campo `createdAt` em Date.
 */
export function computeLlmQuotaUsage(
  providerId: string,
  logs: { createdAt: Date; tokensUsed: number | null }[],
  now: Date = new Date()
): LlmQuotaUsage {
  const cfg = getLlmQuotaPolicy(providerId);
  const windowStart = getQuotaWindowStart(cfg, now);
  const nextRenewal = getNextRenewal(cfg, now);

  const windowTokensUsed = logs
    .filter((l) => l.createdAt >= windowStart && l.createdAt < nextRenewal)
    .reduce((acc, l) => acc + (l.tokensUsed ?? 0), 0);

  const tokenWindowLimit = cfg.tokenWindowLimit;
  const usagePct =
    tokenWindowLimit && tokenWindowLimit > 0
      ? Math.min(100, Math.round((windowTokensUsed / tokenWindowLimit) * 1000) / 10)
      : null;
  const remainingTokens =
    tokenWindowLimit && tokenWindowLimit > 0
      ? Math.max(0, tokenWindowLimit - windowTokensUsed)
      : null;

  const windowDurationMs = nextRenewal.getTime() - windowStart.getTime();
  const elapsedMs = Math.max(0, now.getTime() - windowStart.getTime());
  const windowElapsedPct =
    windowDurationMs > 0 ? Math.min(100, Math.round((elapsedMs / windowDurationMs) * 1000) / 10) : 0;

  // Projeção de exaustão no ritmo atual (tokens/min na janela decorrida).
  let projectedExhaustion: string | null = null;
  if (
    tokenWindowLimit &&
    tokenWindowLimit > 0 &&
    windowTokensUsed > 0 &&
    elapsedMs > 0 &&
    windowTokensUsed < tokenWindowLimit
  ) {
    const ratePerMs = windowTokensUsed / elapsedMs;
    const remainingMs = (tokenWindowLimit - windowTokensUsed) / ratePerMs;
    if (remainingMs > 0) {
      const projected = new Date(now.getTime() + remainingMs);
      if (projected < nextRenewal) {
        projectedExhaustion = projected.toISOString();
      }
    }
  }

  return {
    providerId,
    windowLabel: cfg.policyLabel,
    windowStart: windowStart.toISOString(),
    nextRenewal: nextRenewal.toISOString(),
    nextRenewalLabel: fmtPtBr.format(nextRenewal),
    windowTokensUsed,
    tokenWindowLimit,
    usagePct,
    remainingTokens,
    projectedExhaustion,
    windowElapsedPct,
    policyLabel: cfg.policyLabel,
    limitLabel: cfg.limitLabel,
  };
}
