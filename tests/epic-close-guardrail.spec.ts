import { test, expect } from "@playwright/test";
import { createTicketViaModal, kanbanColumn, kanbanCard, moveCardTo, dismissValidationError } from "./helpers/ui";
import { unique } from "./helpers/supabase-admin";

/**
 * FASE 1 — Guardrail de Fechamento de Épico.
 *
 * Regra (canCloseEpic em lib/domain/ticketRules.ts):
 *   Um Épico SÓ pode ir para FECHADO se TODAS as Atividades/Tarefas filhas
 *   estiverem FECHADO ou CANCELADO. Caso contrário o movimento é bloqueado
 *   com a mensagem "Existem N item(ns) filho(s) em aberto".
 *
 * Cenário: cria um Épico com um filho em ABERTO, tenta fechar o Épico
 * (bloqueado), fecha o filho e então fecha o Épico (permitido).
 */
test.describe("Guardrail de fechamento de Épico", () => {
  test("bloqueia fechar Épico com filho aberto e libera após fechar o filho", async ({ page }) => {
    await page.goto("/dashboard");

    const epicTitle = unique("E2E Guardrail Épico");
    await createTicketViaModal(page, { title: epicTitle, type: "EPICO" });

    const childTitle = unique("E2E Guardrail Filho");
    await createTicketViaModal(page, { title: childTitle, type: "TAREFA", epicTitle });

    // Épico: ABERTO -> EM_ANDAMENTO (permitido)
    let epicCard = kanbanCard(page, epicTitle);
    await expect(epicCard).toBeVisible({ timeout: 30_000 });
    await moveCardTo(page, epicCard, kanbanColumn(page, "Em Andamento"));
    await expect(kanbanColumn(page, "Em Andamento")).toContainText(epicTitle);

    // Tenta fechar o Épico com o filho ainda ABERTO -> bloqueado
    epicCard = kanbanCard(page, epicTitle);
    await moveCardTo(page, epicCard, kanbanColumn(page, "Fechado"));
    await expect(page.getByText(/item\(ns\) filho\(s\) em aberto/)).toBeVisible({
      timeout: 10_000,
    });
    await expect(kanbanColumn(page, "Em Andamento")).toContainText(epicTitle);
    await expect(kanbanColumn(page, "Fechado")).not.toContainText(epicTitle);
    await dismissValidationError(page);

    // Fecha o filho: ABERTO -> EM_ANDAMENTO -> FECHADO
    let childCard = kanbanCard(page, childTitle);
    await moveCardTo(page, childCard, kanbanColumn(page, "Em Andamento"));
    await expect(kanbanColumn(page, "Em Andamento")).toContainText(childTitle);

    childCard = kanbanCard(page, childTitle);
    await moveCardTo(page, childCard, kanbanColumn(page, "Fechado"));
    await expect(kanbanColumn(page, "Fechado")).toContainText(childTitle);

    // Agora o Épico pode ser fechado
    epicCard = kanbanCard(page, epicTitle);
    await moveCardTo(page, epicCard, kanbanColumn(page, "Fechado"));
    await expect(kanbanColumn(page, "Fechado")).toContainText(epicTitle);
    await expect(kanbanColumn(page, "Em Andamento")).not.toContainText(epicTitle);
  });
});
