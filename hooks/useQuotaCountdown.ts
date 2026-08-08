"use client";

import { useEffect, useState } from "react";

export interface QuotaCountdown {
  nextRenewalLabel: string;
  timeRemaining: string;
  renewalCycle: string;
}

export function calculateQuotaCountdown(providerId: string, now: Date = new Date()): QuotaCountdown {
  const currentMs = now.getTime();

  if (providerId === "google") {
    // Google Gemini: diário às 04:00 AM BRT (07:00 UTC / 00:00 PT)
    const targetToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 7, 0, 0));
    let nextTarget = targetToday;
    if (currentMs >= targetToday.getTime()) {
      nextTarget = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 7, 0, 0));
    }

    const diffMs = nextTarget.getTime() - currentMs;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    const isToday = nextTarget.getUTCDate() === now.getUTCDate();
    const renewalLabel = isToday ? "Hoje às 04:00 (BRT)" : "Amanhã às 04:00 (BRT)";

    return {
      nextRenewalLabel: renewalLabel,
      timeRemaining: `Faltam ${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m`,
      renewalCycle: "Diário (04:00 BRT)",
    };
  } else if (providerId === "openai") {
    // OpenAI: mensal no 1º dia do próximo mês às 00:00 UTC (21:00 BRT do dia anterior)
    const nextMonthUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
    const diffMs = nextMonthUtc.getTime() - currentMs;

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    const dayStr = nextMonthUtc.getDate().toString().padStart(2, "0");
    const monthStr = (nextMonthUtc.getMonth() + 1).toString().padStart(2, "0");

    return {
      nextRenewalLabel: `01/${monthStr} às 21:00 (BRT)`,
      timeRemaining: `Faltam ${days}d ${hours.toString().padStart(2, "0")}h`,
      renewalCycle: "Mensal (Dia 1)",
    };
  } else {
    // OpenRouter & Groq: diário às 00:00 UTC (21:00 BRT)
    const targetToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    let nextTarget = targetToday;
    if (currentMs >= targetToday.getTime()) {
      nextTarget = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    }

    const diffMs = nextTarget.getTime() - currentMs;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    const isToday = nextTarget.getUTCDate() === now.getUTCDate();
    const renewalLabel = isToday ? "Hoje às 21:00 (BRT)" : "Amanhã às 21:00 (BRT)";

    return {
      nextRenewalLabel: renewalLabel,
      timeRemaining: `Faltam ${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m`,
      renewalCycle: "Diário (21:00 BRT)",
    };
  }
}

export function useQuotaCountdown(providerId: string): QuotaCountdown {
  const [countdown, setCountdown] = useState<QuotaCountdown>(() =>
    calculateQuotaCountdown(providerId)
  );

  useEffect(() => {
    setCountdown(calculateQuotaCountdown(providerId));

    const timer = setInterval(() => {
      setCountdown(calculateQuotaCountdown(providerId));
    }, 60_000);

    return () => clearInterval(timer);
  }, [providerId]);

  return countdown;
}
